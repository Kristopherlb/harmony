import type { Tree } from '@nx/devkit';
import ts from 'typescript';

type SecurityClassification = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
type JsonObject = Record<string, unknown>;

interface BlueprintMetadata {
  id: string;
  version: string;
  security_classification?: SecurityClassification;
}

interface SecurityLogic {
  required_roles: string[];
  hitl_points: string[];
}

interface DagStep {
  id: string;
  capability: string;
  input_mapping?: Record<string, string>;
  is_parallel?: boolean;
  compensation?: string;
}

interface ArchitecturePlan {
  blueprint_metadata: BlueprintMetadata;
  acceptance_tests: unknown[];
  hitl_requirements?: unknown;
  security_logic: SecurityLogic;
  dag: { steps: DagStep[] };
  temporal_tuning?: unknown;
}

function slugifyBlueprintId(id: string): string {
  return id
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/[._]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function inferDiscoveryTaxonomy(id: string): { domain?: string; subdomain?: string; tags: string[] } {
  const parts = id.split('.').filter((p) => p.trim().length > 0);
  if (parts.length === 0) return { tags: [] };

  // Convention: tools use `<family>.<domain>...` (e.g., golden.<domain>.<...>, workflows.<...>).
  if (parts[0] === 'golden') {
    // For modern IDs: golden.<domain>.<subdomain?>.<name>
    if (parts.length >= 3) {
      const domain = parts[1];
      const subdomain = parts.length >= 4 ? parts[2] : undefined;
      const tags = [domain, subdomain].filter((x): x is string => typeof x === 'string' && x.length > 0);
      return { domain, subdomain, tags };
    }
    // Legacy: golden.<name> (domain is derived elsewhere; keep empty here).
    return { tags: [] };
  }

  const domain = parts[0];
  const subdomain = parts.length >= 2 ? parts.slice(1).join('.') : undefined;
  const tags = [domain].filter((x): x is string => typeof x === 'string' && x.length > 0);
  return { domain, subdomain, tags };
}

function toCamelCase(kebab: string): string {
  const [first, ...rest] = kebab.split('-');
  return [first, ...rest.map((p) => p.slice(0, 1).toUpperCase() + p.slice(1))].join('');
}

function stepVarName(stepId: string): string {
  return toCamelCase(slugifyBlueprintId(stepId));
}

function isContextOnlyMapping(mapping: Record<string, string> | undefined): boolean {
  if (!mapping) return true;
  return Object.values(mapping).every((v) => v.startsWith('context.'));
}

function renderMappedInput(mapping: Record<string, string> | undefined): string {
  if (!mapping || Object.keys(mapping).length === 0) return '{}';
  const entries = Object.entries(mapping)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => {
      if (v.startsWith('context.')) {
        const f = v.slice('context.'.length);
        return `        ${JSON.stringify(k)}: (input as any)[${JSON.stringify(f)}],`;
      }
      if (v.startsWith('steps.')) {
        const parts = v.split('.');
        const refId = parts[1] ?? '';
        const refField = parts[2] ?? '';
        return `        ${JSON.stringify(k)}: (steps as any)[${JSON.stringify(refId)}]?.[${JSON.stringify(refField)}],`;
      }
      return `        ${JSON.stringify(k)}: undefined,`;
    });

  return `{\n${entries.join('\n')}\n      }`;
}

function renderLogicBody(steps: DagStep[]): string {
  type Batch = { kind: 'parallel' | 'sequential'; steps: DagStep[] };
  const batches: Batch[] = [];

  for (const step of steps) {
    const canParallel = step.is_parallel === true && isContextOnlyMapping(step.input_mapping);
    if (canParallel) {
      const last = batches.at(-1);
      if (last?.kind === 'parallel') last.steps.push(step);
      else batches.push({ kind: 'parallel', steps: [step] });
      continue;
    }
    batches.push({ kind: 'sequential', steps: [step] });
  }

  const out: string[] = [];
  for (const batch of batches) {
    if (batch.kind === 'parallel' && batch.steps.length > 1) {
      const vars = batch.steps.map((s) => stepVarName(s.id));
      const calls = batch.steps.map((s) => {
        const mapped = renderMappedInput(s.input_mapping);
        return `      this.executeById(${JSON.stringify(s.capability)}, ${mapped})`;
      });
      out.push(`    const [${vars.join(', ')}] = await Promise.all([\n${calls.join(',\n')},\n    ]);`);
      for (const step of batch.steps) {
        const v = stepVarName(step.id);
        out.push(`    steps[${JSON.stringify(step.id)}] = ${v};`);
        if (step.compensation) {
          out.push(
            `    this.addCompensation(async () => {\n      // TODO: Map undo input from prior outputs (design-compensation-strategy).\n      await this.executeById(${JSON.stringify(step.compensation)}, {});\n    });`
          );
        }
      }
      continue;
    }

    for (const step of batch.steps) {
      const v = stepVarName(step.id);
      const mapped = renderMappedInput(step.input_mapping);
      out.push(`    const ${v} = await this.executeById(${JSON.stringify(step.capability)}, ${mapped});`);
      out.push(`    steps[${JSON.stringify(step.id)}] = ${v};`);
      if (step.compensation) {
        out.push(
          `    this.addCompensation(async () => {\n      // TODO: Map undo input from prior outputs (design-compensation-strategy).\n      await this.executeById(${JSON.stringify(step.compensation)}, {});\n    });`
        );
      }
    }
  }

  return out.join('\n');
}

function collectStepOutputFieldRequirements(steps: DagStep[]): Map<string, Set<string>> {
  const required = new Map<string, Set<string>>();
  for (const step of steps) {
    required.set(step.id, new Set<string>());
  }
  for (const step of steps) {
    const mapping = step.input_mapping;
    if (!mapping) continue;
    for (const v of Object.values(mapping)) {
      if (!v.startsWith('steps.')) continue;
      const parts = v.split('.');
      const refId = parts[1];
      const field = parts[2];
      if (!refId || !field) continue;
      if (!required.has(refId)) required.set(refId, new Set<string>());
      required.get(refId)!.add(field);
    }
  }
  return required;
}

function countOccurrences(list: string[], value: string): number {
  let n = 0;
  for (const v of list) if (v === value) n++;
  return n;
}

function readJsonFromTree(tree: Tree, path: string): unknown {
  if (!tree.exists(path)) throw new Error(`Plan file not found: ${path}`);
  const raw = tree.read(path, 'utf-8');
  if (!raw) throw new Error(`Plan file empty: ${path}`);
  return JSON.parse(raw) as unknown;
}

function extractMetadataId(source: string): string | undefined {
  const match = source.match(/metadata\s*:\s*\{[\s\S]*?\bid\s*:\s*['"]([^'"]+)['"]/m);
  return match?.[1];
}

function findNamedFunction(sourceFile: ts.SourceFile, name: string): ts.FunctionDeclaration | undefined {
  for (const stmt of sourceFile.statements) {
    if (ts.isFunctionDeclaration(stmt) && stmt.name?.text === name) return stmt;
  }
  return undefined;
}

function formatImport(symbol: string, modulePath: string): string {
  return `import { ${symbol} } from '${modulePath}';`;
}

function updateBlueprintRegistry(tree: Tree, input: {
  outDir: string;
  fileBase: string;
  blueprintId: string;
  workflowType: string;
}): void {
  const registryPath = 'packages/blueprints/src/registry.ts';
  if (!tree.exists(registryPath)) throw new Error(`Missing registry: ${registryPath}`);
  const current = tree.read(registryPath, 'utf-8') ?? '';

  const workflowsIndexPath = `${input.outDir}/index.ts`;
  if (!tree.exists(workflowsIndexPath)) throw new Error(`Missing workflows index: ${workflowsIndexPath}`);
  const workflowsIndexSource = tree.read(workflowsIndexPath, 'utf-8') ?? '';
  if (!workflowsIndexSource.includes(`export { ${input.workflowType} }`)) {
    throw new Error(`Workflows index missing export for workflowType ${input.workflowType}: ${workflowsIndexPath}`);
  }

  const sf = ts.createSourceFile(registryPath, current, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const importDecls = sf.statements.filter(ts.isImportDeclaration);
  if (importDecls.length === 0) {
    throw new Error(`Unsupported registry format (missing imports): ${registryPath}`);
  }

  const typeImport = importDecls.find((decl) => {
    if (!ts.isStringLiteral(decl.moduleSpecifier)) return false;
    return decl.moduleSpecifier.text === './descriptors/types.js';
  });
  if (!typeImport) {
    throw new Error(`Unsupported registry format (missing type import from ./descriptors/types.js): ${registryPath}`);
  }

  // Descriptor imports are the canonical registry surface for Node-land discovery.
  const existingImports = new Map<string, string>();
  for (const decl of importDecls) {
    if (!ts.isStringLiteral(decl.moduleSpecifier)) continue;
    const mod = decl.moduleSpecifier.text;
    if (!mod.startsWith('./descriptors/') || !mod.endsWith('.js')) continue;
    if (mod === './descriptors/types.js') continue;
    const bindings = decl.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const el of bindings.elements) {
      existingImports.set(el.name.text, mod);
    }
  }

  const descriptorConstName = `${input.workflowType}Descriptor`;
  const newDescriptorImport = `./descriptors/${input.fileBase}.descriptor.js`;
  existingImports.set(descriptorConstName, newDescriptorImport);

  // Extract existing entries directly from registry for determinism.
  const entryByDescriptorSym = new Map<string, { blueprintId: string; workflowType: string }>();
  const entryRegex =
    /\[\s*['"]([^'"]+)['"]\s*,\s*\{[\s\S]*?blueprintId\s*:\s*['"]([^'"]+)['"][\s\S]*?workflowType\s*:\s*['"]([^'"]+)['"][\s\S]*?descriptor\s*:\s*([A-Za-z0-9_]+)/g;
  for (const match of current.matchAll(entryRegex)) {
    const blueprintId = match[2] ?? match[1] ?? '';
    const workflowType = match[3] ?? '';
    const sym = match[4] ?? '';
    if (blueprintId && workflowType && sym) entryByDescriptorSym.set(sym, { blueprintId, workflowType });
  }
  entryByDescriptorSym.set(descriptorConstName, { blueprintId: input.blueprintId, workflowType: input.workflowType });

  for (const [sym, info] of entryByDescriptorSym.entries()) {
    if (sym !== descriptorConstName && info.blueprintId === input.blueprintId) {
      throw new Error(`Blueprint metadata.id already exists: ${input.blueprintId}`);
    }
  }

  const symsSorted = Array.from(existingImports.keys())
    .map((sym) => ({ sym, id: entryByDescriptorSym.get(sym)?.blueprintId ?? `zzzz.${sym}` }))
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((x) => x.sym);

  const entries = symsSorted.map((sym) => {
    const modulePath = existingImports.get(sym);
    if (!modulePath) throw new Error(`Internal error: missing import entry for ${sym}`);

    const info = entryByDescriptorSym.get(sym);
    if (!info) {
      throw new Error(`Unsupported registry format (missing entry for descriptor ${sym}): ${registryPath}`);
    }

    return { sym, modulePath, blueprintId: info.blueprintId, workflowType: info.workflowType };
  });

  const importBlockStart = importDecls[0]?.getFullStart() ?? 0;
  const importBlockEnd = importDecls.at(-1)?.getEnd() ?? 0;
  const newImportBlock = [...entries.map((e) => formatImport(e.sym, e.modulePath)), "import type { BlueprintDescriptor } from './descriptors/types.js';", ''].join('\n');

  const createFn = findNamedFunction(sf, 'createBlueprintRegistry');
  if (!createFn) throw new Error(`Unsupported registry format (missing createBlueprintRegistry): ${registryPath}`);

  const entryLines = entries.map(
    (e) =>
      `    ['${e.blueprintId}', { blueprintId: '${e.blueprintId}', workflowType: '${e.workflowType}', descriptor: ${e.sym} }],`
  );
  const newCreateFn = `export function createBlueprintRegistry(): BlueprintRegistry {\n  // Deterministic ordering: sorted by blueprintId.\n  return new Map<string, BlueprintRegistryEntry>([\n${entryLines.join(
    '\n'
  )}\n  ]);\n}\n`;

  const beforeImports = current.slice(0, importBlockStart);
  const afterImportsRaw = current.slice(importBlockEnd);
  const afterImports = '\n' + afterImportsRaw.replace(/^[ \t\r\n]*/, '');
  const withNewImports = beforeImports + newImportBlock + afterImports;

  const sf2 = ts.createSourceFile(registryPath, withNewImports, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const createFn2 = findNamedFunction(sf2, 'createBlueprintRegistry');
  if (!createFn2) throw new Error(`Unsupported registry format (missing createBlueprintRegistry): ${registryPath}`);

  const prefix = withNewImports.slice(0, createFn2.getStart()).replace(/[ \t\r\n]*$/, '\n\n');
  const suffix = withNewImports.slice(createFn2.getEnd()).replace(/^[ \t]*\n+/, '');
  const updated = prefix + newCreateFn.trimEnd() + '\n\n' + suffix;
  tree.write(registryPath, updated);
}

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object';
}

function parseArchitecturePlan(input: unknown): ArchitecturePlan {
  if (!isObject(input)) throw new Error('Invalid plan: not an object');

  const blueprintMetadataRaw = input.blueprint_metadata;
  if (!isObject(blueprintMetadataRaw)) throw new Error('Invalid plan: missing blueprint_metadata');

  const id = blueprintMetadataRaw.id;
  const version = blueprintMetadataRaw.version;
  if (typeof id !== 'string' || id.trim() === '') throw new Error('Invalid plan: blueprint_metadata.id required');
  if (typeof version !== 'string' || version.trim() === '') {
    throw new Error('Invalid plan: blueprint_metadata.version required');
  }

  const scRaw = blueprintMetadataRaw.security_classification;
  const sc = typeof scRaw === 'string' ? (scRaw as SecurityClassification) : undefined;
  if (sc && !['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'].includes(sc)) {
    throw new Error(`Invalid plan: security_classification must be an OCS classification (${String(sc)})`);
  }

  const dagRaw = input.dag;
  if (!isObject(dagRaw)) throw new Error('Invalid plan: missing dag');
  if (!Array.isArray(dagRaw.steps)) throw new Error('Invalid plan: missing dag.steps');

  const steps: DagStep[] = dagRaw.steps.map((s, idx) => {
    if (!isObject(s)) throw new Error(`Invalid step at index ${idx}: not an object`);
    if (typeof s.id !== 'string' || s.id.trim() === '') throw new Error('Invalid step: id required');
    if (typeof s.capability !== 'string' || s.capability.trim() === '') {
      throw new Error(`Invalid step ${String(s.id)}: capability required`);
    }

    let input_mapping: Record<string, string> | undefined;
    if (isObject(s.input_mapping)) {
      input_mapping = {};
      for (const [k, v] of Object.entries(s.input_mapping)) {
        if (typeof v === 'string') input_mapping[k] = v;
      }
    }

    return {
      id: s.id,
      capability: s.capability,
      input_mapping,
      is_parallel: typeof s.is_parallel === 'boolean' ? s.is_parallel : undefined,
      compensation: typeof s.compensation === 'string' ? s.compensation : undefined,
    };
  });

  if (!Array.isArray(input.acceptance_tests)) {
    throw new Error('Invalid plan: acceptance_tests must be an array');
  }

  const securityLogicRaw = input.security_logic;
  const required_roles: string[] =
    isObject(securityLogicRaw) && Array.isArray(securityLogicRaw.required_roles)
      ? securityLogicRaw.required_roles.filter((x: unknown): x is string => typeof x === 'string')
      : [];
  const hitl_points: string[] =
    isObject(securityLogicRaw) && Array.isArray(securityLogicRaw.hitl_points)
      ? securityLogicRaw.hitl_points.filter((x: unknown): x is string => typeof x === 'string')
      : [];

  return {
    blueprint_metadata: { id, version, security_classification: sc },
    acceptance_tests: input.acceptance_tests,
    hitl_requirements: input.hitl_requirements,
    security_logic: { required_roles, hitl_points },
    dag: { steps },
    temporal_tuning: input.temporal_tuning,
  };
}

function validateMappings(steps: DagStep[]): void {
  const seen = new Set<string>();
  for (const step of steps) {
    if (seen.has(step.id)) throw new Error(`Invalid plan: duplicate step id: ${step.id}`);
    seen.add(step.id);
  }

  const prior = new Set<string>();
  for (const step of steps) {
    const mapping = step.input_mapping;
    if (mapping) {
      for (const value of Object.values(mapping)) {
        if (value.startsWith('context.')) continue;
        if (value.startsWith('steps.')) {
          const parts = value.split('.');
          const refId = parts[1];
          if (!refId) throw new Error(`Invalid input_mapping reference: ${value}`);
          if (!prior.has(refId)) throw new Error(`Invalid forward reference in input_mapping: ${value}`);
          continue;
        }
        throw new Error(`Invalid input_mapping reference (must be context.* or steps.*): ${value}`);
      }
    }
    prior.add(step.id);
  }
}

function upsertWorkflowsIndexExport(tree: Tree, outDir: string, exportName: string, runFileBase: string): void {
  const indexPath = `${outDir}/index.ts`;
  if (!tree.exists(indexPath)) throw new Error(`Missing workflows index: ${indexPath}`);
  const current = tree.read(indexPath, 'utf-8') ?? '';

  const exportLine = `export { ${exportName} } from './${runFileBase}.workflow-run';`;
  if (current.includes(exportLine)) return;

  const lines = current.split('\n');
  const exportLines = lines.filter((l) => l.startsWith('export { '));
  const rest = lines.filter((l) => !l.startsWith('export { '));

  const nextExports = [...exportLines, exportLine].sort((a, b) => a.localeCompare(b));
  const next = [...rest.filter((l) => l.trim().length > 0), ...nextExports, ''].join('\n');
  tree.write(indexPath, next);
}

function assertCapabilitiesExistIfRegistryPresent(tree: Tree, steps: DagStep[]): void {
  const registryPath = 'packages/capabilities/src/registry.ts';
  if (!tree.exists(registryPath)) return;

  const registry = tree.read(registryPath, 'utf-8') ?? '';
  const importRegex = /^import \{ ([A-Za-z0-9_]+) \} from '\.\/([A-Za-z0-9_.-]+)\.js';\s*$/gm;

  const known = new Set<string>();
  for (const match of registry.matchAll(importRegex)) {
    const moduleBase = match[2];
    const capPath = `packages/capabilities/src/${moduleBase}.ts`;
    if (!tree.exists(capPath)) continue;
    const src = tree.read(capPath, 'utf-8') ?? '';
    const id = extractMetadataId(src);
    if (id) known.add(id);
  }

  for (const step of steps) {
    const capId = step.capability;
    if (!known.has(capId)) {
      throw new Error(`Unknown capability referenced: ${capId}`);
    }
  }
}

export interface BlueprintGeneratorSchema {
  plan: string;
  outDir?: string;
}

export default async function blueprintGenerator(tree: Tree, options: BlueprintGeneratorSchema) {
  const outDir = options.outDir ?? 'packages/blueprints/src/workflows';
  const plan = parseArchitecturePlan(readJsonFromTree(tree, options.plan));

  validateMappings(plan.dag.steps);
  assertCapabilitiesExistIfRegistryPresent(tree, plan.dag.steps);

  const blueprintId = plan.blueprint_metadata.id;
  const discovery = inferDiscoveryTaxonomy(blueprintId);
  const fileBase = slugifyBlueprintId(blueprintId);
  const exportName = `${toCamelCase(fileBase)}Workflow`;
  const className = `${exportName[0].toUpperCase()}${exportName.slice(1)}`;

  const workflowPath = `${outDir}/${fileBase}.workflow.ts`;
  const runPath = `${outDir}/${fileBase}.workflow-run.ts`;
  const workflowTestPath = `${outDir}/${fileBase}.workflow.test.ts`;
  const descriptorPath = `packages/blueprints/src/descriptors/${fileBase}.descriptor.ts`;
  const e2eScriptPath = `packages/blueprints/scripts/generated/${fileBase}.workflow-e2e-propagation.ts`;
  const e2eTestPath = `packages/blueprints/src/e2e/${fileBase}.workflow-e2e.test.ts`;

  const contextFields = new Set<string>();
  for (const step of plan.dag.steps) {
    const mapping = step.input_mapping;
    if (!mapping) continue;
    for (const v of Object.values(mapping)) {
      if (v.startsWith('context.')) contextFields.add(v.slice('context.'.length));
    }
  }
  const inputSchemaFields = Array.from(contextFields)
    .filter((f) => f.length > 0)
    .sort((a, b) => a.localeCompare(b))
    .map((f) => `  ${JSON.stringify(f)}: z.unknown(),`)
    .join('\n');

  if (!tree.exists(workflowPath)) {
    const logicBody = renderLogicBody(plan.dag.steps);
    const lastStepId = plan.dag.steps.at(-1)?.id ?? '';
    const file = `/**
 * ${workflowPath}
 * Generated WCS Blueprint from architecture plan (GSS-001 / WCS-001).
 *
 * TODO: Refine schemas and output mapping.
 */
import { BaseBlueprint } from '@golden/core/workflow';
import { z } from '@golden/schema-registry';

export type ${className}Input = { ${Array.from(contextFields)
      .sort((a, b) => a.localeCompare(b))
      .map((f) => `${JSON.stringify(f)}: unknown;`)
      .join(' ')} };
export type ${className}Output = unknown;

export class ${className} extends BaseBlueprint<${className}Input, ${className}Output, object> {
  readonly metadata = {
    id: ${JSON.stringify(blueprintId)},
    version: ${JSON.stringify(plan.blueprint_metadata.version)},
    name: ${JSON.stringify(blueprintId)},
    description: 'TODO: Describe what this blueprint does (purpose, not effect).',
    owner: 'platform',
    costCenter: 'CC-0',
    tags: ${JSON.stringify(discovery.tags)},
  };

  readonly security = {
    requiredRoles: ${JSON.stringify(plan.security_logic.required_roles)},
    classification: ${JSON.stringify(plan.blueprint_metadata.security_classification ?? 'INTERNAL')} as const,
  };

  readonly operations = {
    sla: { targetDuration: '1m', maxDuration: '5m' },
  };

  readonly inputSchema = z.object({
${inputSchemaFields || '  // No context.* inputs detected from input_mapping\n'}
  }) as BaseBlueprint<${className}Input, ${className}Output, object>['inputSchema'];

  readonly configSchema = z.object({}) as BaseBlueprint<${className}Input, ${className}Output, object>['configSchema'];

  protected async logic(input: ${className}Input, _config: object): Promise<${className}Output> {
    void _config;
    const steps: Record<string, unknown> = {};
${logicBody}

    // Default: return final step output.
    return steps[${JSON.stringify(lastStepId)}] as ${className}Output;
  }
}
`;
    tree.write(workflowPath, file);
  }

  if (!tree.exists(runPath)) {
    const runFile = `/**
 * ${runPath}
 * Workflow entrypoint for worker bundle.
 */
import { ${className}, type ${className}Input, type ${className}Output } from './${fileBase}.workflow';

export async function ${exportName}(input: ${className}Input): Promise<${className}Output> {
  const w = new ${className}();
  return w.main(input, {});
}
`;
    tree.write(runPath, runFile);
  }

  if (!tree.exists(workflowTestPath)) {
    tree.write(
      workflowTestPath,
      `/**
 * ${workflowTestPath}
 * Generated smoke test: validates static blueprint metadata/schemas compile.
 */
import { describe, it, expect } from 'vitest';
import { ${className} } from './${fileBase}.workflow';

describe('${className}', () => {
  it('exposes metadata and schemas', () => {
    const w = new ${className}();
    expect(w.metadata.id).toBe(${JSON.stringify(blueprintId)});
    expect(w.metadata.version).toBe(${JSON.stringify(plan.blueprint_metadata.version)});
    expect(Array.isArray(w.security.requiredRoles)).toBe(true);
  });
});
`
    );
  }

  if (!tree.exists(descriptorPath)) {
    const classification = plan.blueprint_metadata.security_classification ?? 'INTERNAL';
    const descFile = `/**
 * ${descriptorPath}
 * Generated blueprint descriptor (metadata + input schema) for Node-land discovery.
 */
import { z } from '@golden/schema-registry';
import type { BlueprintDescriptor } from './types.js';

export const ${exportName}Descriptor: BlueprintDescriptor = {
  blueprintId: ${JSON.stringify(blueprintId)},
  workflowType: ${JSON.stringify(exportName)},
  metadata: {
    id: ${JSON.stringify(blueprintId)},
    version: ${JSON.stringify(plan.blueprint_metadata.version)},
    description: 'TODO: Describe what this blueprint does (purpose, not effect).',
    ${discovery.domain ? `domain: ${JSON.stringify(discovery.domain)},` : ''}
    ${discovery.subdomain ? `subdomain: ${JSON.stringify(discovery.subdomain)},` : ''}
    ${discovery.tags.length ? `tags: ${JSON.stringify(discovery.tags)},` : ''}
  },
  inputSchema: z.object({
${inputSchemaFields || '  // No context.* inputs detected from input_mapping\n'}
  }),
  security: { classification: ${JSON.stringify(classification)} as any },
};
`;
    tree.write(descriptorPath, descFile);
  }

  if (!tree.exists(e2eScriptPath)) {
    const outputFieldsByStepId = collectStepOutputFieldRequirements(plan.dag.steps);

    const capToFields = new Map<string, Set<string>>();
    for (const step of plan.dag.steps) {
      const set = capToFields.get(step.capability) ?? new Set<string>();
      for (const f of outputFieldsByStepId.get(step.id) ?? []) set.add(f);
      capToFields.set(step.capability, set);
    }
    const capOutputEntries = Array.from(capToFields.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([capId, fields]) => {
        const fieldObj = Array.from(fields)
          .sort((a, b) => a.localeCompare(b))
          .map((f) => `${JSON.stringify(f)}: ${JSON.stringify(`${capId}.${f}`)}`)
          .join(', ');
        return `  ${JSON.stringify(capId)}: { ${fieldObj} },`;
      })
      .join('\n');

    const inputObjLines = Array.from(contextFields)
      .sort((a, b) => a.localeCompare(b))
      .map((f) => `    ${JSON.stringify(f)}: ${JSON.stringify(`context.${f}`)},`)
      .join('\n');

    const capSequence = plan.dag.steps.map((s) => s.capability);
    const failingCapId = plan.dag.steps.at(-1)?.capability ?? '';
    const failingCapOccurrence = failingCapId ? countOccurrences(capSequence, failingCapId) : 1;

    const registeredCompensations = plan.dag.steps
      .slice(0, -1)
      .filter((s) => typeof s.compensation === 'string' && s.compensation.length > 0)
      .map((s) => s.compensation as string);
    const expectedLifo = [...registeredCompensations].reverse();

    tree.write(
      e2eScriptPath,
      `/**
 * ${e2eScriptPath}
 * Generated Temporal propagation + saga test runner (clean Node process).
 *
 * Runs two scenarios:
 * - Happy path (no injected failure)
 * - Failure at last step -> asserts compensations run in LIFO order (WCS/TCS)
 */
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker, bundleWorkflowCode } from '@temporalio/worker';
import type { ExecuteCapabilityActivityInput, GoldenContext } from '@golden/core';
import { SECURITY_CONTEXT_MEMO_KEY, GOLDEN_CONTEXT_MEMO_KEY } from '@golden/core/workflow';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');
const workflowsPath = path.join(repoRoot, 'packages/blueprints/src/workflows');
const outDir = path.join(repoRoot, 'packages/blueprints/dist');
const bundlePath = path.join(outDir, ${JSON.stringify(`workflow-bundle-${fileBase}.js`)});

const WORKFLOW_TYPE = ${JSON.stringify(exportName)};
const FAILING_CAP_ID = ${JSON.stringify(failingCapId)};
const FAILING_CAP_OCCURRENCE = ${JSON.stringify(failingCapOccurrence)};
const EXPECTED_COMP_LIFO: string[] = ${JSON.stringify(expectedLifo, null, 2)};

const OUTPUT_BY_CAP_ID: Record<string, Record<string, unknown>> = {
${capOutputEntries || '  // No step output fields referenced by mappings\n'}
};

const INPUT: Record<string, unknown> = {
${inputObjLines || '  // No context.* inputs detected from input_mapping\n'}
};

async function bundle() {
  await mkdir(outDir, { recursive: true });
  const { code } = await bundleWorkflowCode({ workflowsPath, ignoreModules: [] });
  await writeFile(bundlePath, code);
}

async function runScenario(options: { injectFailure: boolean }) {
  const recordedCalls: ExecuteCapabilityActivityInput<unknown>[] = [];
  const countByCap = new Map<string, number>();

  const runAs = 'user:e2e';
  const traceId = 'trace-e2e-123';
  const ctx: GoldenContext = {
    app_id: ${JSON.stringify(blueprintId)},
    environment: 'test',
    initiator_id: runAs,
    trace_id: traceId,
    data_classification: ${JSON.stringify(plan.blueprint_metadata.security_classification ?? 'INTERNAL')},
    cost_center: 'CC-e2e',
  };

  const testEnv = await TestWorkflowEnvironment.createTimeSkipping();
  try {
    const worker = await Worker.create({
      connection: testEnv.nativeConnection,
      namespace: testEnv.options.namespace ?? 'default',
      taskQueue: ${JSON.stringify(`e2e-${fileBase}`)},
      workflowBundle: { codePath: bundlePath },
      reuseV8Context: false,
      activities: {
        async executeDaggerCapability<In, Out>(input: ExecuteCapabilityActivityInput<In>): Promise<Out> {
          recordedCalls.push(input as ExecuteCapabilityActivityInput<unknown>);
          const capId = input.capId;
          const next = (countByCap.get(capId) ?? 0) + 1;
          countByCap.set(capId, next);

          if (options.injectFailure && capId === FAILING_CAP_ID && next === FAILING_CAP_OCCURRENCE) {
            throw new Error('INJECTED_FAILURE');
          }

          const out = OUTPUT_BY_CAP_ID[capId] ?? {};
          return out as Out;
        },
      },
    });

    await worker.runUntil(async () => {
      const handle = await testEnv.client.workflow.start(WORKFLOW_TYPE, {
        taskQueue: ${JSON.stringify(`e2e-${fileBase}`)},
        workflowId: ${JSON.stringify(`e2e-${fileBase}-`)} + '1',
        args: [INPUT],
        memo: {
          [SECURITY_CONTEXT_MEMO_KEY]: { initiatorId: runAs, roles: [], tokenRef: '', traceId },
          [GOLDEN_CONTEXT_MEMO_KEY]: ctx,
        },
      });

      if (options.injectFailure) {
        await assert.rejects(() => handle.result(), /INJECTED_FAILURE/);
      } else {
        const result = await handle.result();
        // Minimal assertion: result is the last step output (generator default).
        assert.ok(result !== undefined);
      }
    });

    return recordedCalls.map((c) => c.capId);
  } finally {
    await testEnv.teardown();
  }
}

async function main() {
  await bundle();

  // 1) Happy path (no failure injection)
  await runScenario({ injectFailure: false });

  // 2) Failure at last step => compensations execute LIFO (WCS/TCS)
  const calls = await runScenario({ injectFailure: true });
  const compCalls = calls.filter((c) => EXPECTED_COMP_LIFO.includes(c));
  assert.deepEqual(compCalls, EXPECTED_COMP_LIFO);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
`
    );
  }

  if (!tree.exists(e2eTestPath)) {
    tree.write(
      e2eTestPath,
      `/**
 * ${e2eTestPath}
 * TCS-001: executes Temporal TestWorkflowEnvironment in a clean Node process.
 *
 * Why: running Worker bundles inside Vitest can be flaky due to environment patching.
 */
import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

describe('${className} e2e (Temporal)', () => {
  it('runs propagation + saga/LIFO assertions', () => {
    const repoRoot = process.cwd();
    const tsxBin = path.resolve(repoRoot, 'node_modules', '.bin', 'tsx');
    const scriptPath = path.resolve(repoRoot, ${JSON.stringify(e2eScriptPath)});
    expect(() => {
      execFileSync(tsxBin, [scriptPath], { cwd: repoRoot, stdio: 'pipe' });
    }).not.toThrow();
  }, 120_000);
});
`
    );
  }

  upsertWorkflowsIndexExport(tree, outDir, exportName, fileBase);
  updateBlueprintRegistry(tree, { outDir, fileBase, blueprintId, workflowType: exportName });

  return () => {};
}

