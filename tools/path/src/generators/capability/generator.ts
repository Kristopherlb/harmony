import type { Tree } from '@nx/devkit';
import ts from 'typescript';

function assertKebabCase(value: string): void {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    throw new Error(`Invalid name (expected kebab-case): ${value}`);
  }
}

function toCamelCase(kebab: string): string {
  const [first, ...rest] = kebab.split('-');
  return [first, ...rest.map((p) => p.slice(0, 1).toUpperCase() + p.slice(1))].join('');
}

function extractMetadataId(source: string): string | undefined {
  const match = source.match(/metadata\s*:\s*\{[\s\S]*?\bid\s*:\s*['"]([^'"]+)['"]/m);
  return match?.[1];
}

function upsertCapabilitiesIndexExport(tree: Tree, moduleBase: string, exportConstName: string): void {
  const indexPath = 'packages/capabilities/index.ts';
  if (!tree.exists(indexPath)) return;

  const current = tree.read(indexPath, 'utf-8') ?? '';
  const exportLine = `export { ${exportConstName} } from './src/${moduleBase}.js';`;
  if (current.includes(exportLine)) return;

  const lines = current.split('\n');
  const existingExports = lines.filter((l) => l.startsWith('export { '));
  const nonExportLines = lines.filter((l) => !l.startsWith('export { '));

  const updatedExports = [...existingExports, exportLine].sort((a, b) => a.localeCompare(b));
  const next = [...nonExportLines.filter((l) => l.trim().length > 0), ...updatedExports, ''].join('\n');
  tree.write(indexPath, next);
}

function findNamedFunction(sourceFile: ts.SourceFile, name: string): ts.FunctionDeclaration | undefined {
  for (const stmt of sourceFile.statements) {
    if (ts.isFunctionDeclaration(stmt) && stmt.name?.text === name) return stmt;
  }
  return undefined;
}

function formatImport(symbol: string, moduleBase: string): string {
  return `import { ${symbol} } from './${moduleBase}.js';`;
}

function updateCapabilityRegistry(tree: Tree, moduleBase: string, exportConstName: string, newId: string): void {
  const registryPath = 'packages/capabilities/src/registry.ts';
  if (!tree.exists(registryPath)) throw new Error(`Missing registry: ${registryPath}`);
  const current = tree.read(registryPath, 'utf-8') ?? '';

  const sf = ts.createSourceFile(registryPath, current, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);

  const importDecls = sf.statements.filter(ts.isImportDeclaration);
  const capabilityTypeImport = importDecls.find((d) => {
    if (!ts.isStringLiteral(d.moduleSpecifier)) return false;
    if (d.moduleSpecifier.text !== '@golden/core') return false;
    return Boolean(d.importClause?.isTypeOnly);
  });
  if (!capabilityTypeImport) {
    throw new Error(`Unsupported registry format (missing "import type" from @golden/core): ${registryPath}`);
  }

  const existingImports = new Map<string, { symbol: string; moduleBase: string }>();
  for (const decl of importDecls) {
    if (!ts.isStringLiteral(decl.moduleSpecifier)) continue;
    const mod = decl.moduleSpecifier.text;
    if (!mod.startsWith('./') || !mod.endsWith('.js')) continue;
    const moduleBase = mod.slice(2, -3);
    const bindings = decl.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const el of bindings.elements) {
      const sym = el.name.text;
      existingImports.set(sym, { symbol: sym, moduleBase });
    }
  }
  existingImports.set(exportConstName, { symbol: exportConstName, moduleBase });

  const symToId = new Map<string, string>();
  for (const imp of existingImports.values()) {
    const tsPath = `packages/capabilities/src/${imp.moduleBase}.ts`;
    if (!tree.exists(tsPath)) continue;
    const src = tree.read(tsPath, 'utf-8') ?? '';
    const id = extractMetadataId(src);
    if (id) symToId.set(imp.symbol, id);
  }
  symToId.set(exportConstName, newId);

  for (const [sym, id] of symToId.entries()) {
    if (sym !== exportConstName && id === newId) {
      throw new Error(`Capability metadata.id already exists: ${newId}`);
    }
  }

  const sortedSyms = Array.from(existingImports.keys())
    .map((sym) => ({ sym, id: symToId.get(sym) ?? `zzzz.${sym}` }))
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((x) => x.sym);

  const importsSorted = sortedSyms.map((sym) => {
    const imp = existingImports.get(sym);
    if (!imp) throw new Error(`Internal error: missing import entry for ${sym}`);
    return { sym, moduleBase: imp.moduleBase, id: symToId.get(sym) ?? `zzzz.${sym}` };
  });

  // Canonicalize the type-only import to be robust to formatting differences (TCS/GSS determinism).
  const typeImportText = "import type { Capability } from '@golden/core';";
  const importBlockStart = importDecls.length ? importDecls[0].getFullStart() : 0;
  const importBlockEnd = importDecls.length ? importDecls[importDecls.length - 1].getEnd() : 0;

  const newImportBlock = [typeImportText, ...importsSorted.map((x) => formatImport(x.sym, x.moduleBase)), ''].join('\n');

  const createFn = findNamedFunction(sf, 'createCapabilityRegistry');
  if (!createFn) throw new Error(`Unsupported registry format (missing createCapabilityRegistry): ${registryPath}`);

  const entryLines = importsSorted.map(
    (x) => `    [${x.sym}.metadata.id, ${x.sym} as unknown as Capability<unknown, unknown, unknown, unknown>],`
  );
  const newCreateFn = `export function createCapabilityRegistry(): CapabilityRegistry {\n  return new Map([\n${entryLines.join(
    '\n'
  )}\n  ]);\n}\n`;

  const beforeImports = current.slice(0, importBlockStart);
  const afterImportsRaw = current.slice(importBlockEnd);
  const afterImports = '\n' + afterImportsRaw.replace(/^[ \t\r\n]*/, '');
  const withNewImports = beforeImports + newImportBlock + afterImports;

  // Re-parse after import rewrite so positions remain correct.
  const sf2 = ts.createSourceFile(registryPath, withNewImports, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const createFn2 = findNamedFunction(sf2, 'createCapabilityRegistry');
  if (!createFn2) throw new Error(`Unsupported registry format (missing createCapabilityRegistry): ${registryPath}`);

  const prefix = withNewImports.slice(0, createFn2.getStart()).replace(/[ \t\r\n]*$/, '\n\n');
  const suffix = withNewImports.slice(createFn2.getEnd()).replace(/^[ \t]*\n+/, '');
  const updated = prefix + newCreateFn.trimEnd() + '\n\n' + suffix;
  tree.write(registryPath, updated);
}

export interface CapabilityGeneratorSchema {
  name: string;
  /**
   * Discovery taxonomy domain (CDM-001). Used as the first segment after "golden.".
   * Example: "security", "observability", "ci", "k8s".
   */
  domain: string;
  /**
   * Optional discovery taxonomy subdomain (CDM-001).
   * Example: "oauth", "grafana".
   */
  subdomain?: string;
  pattern: 'connector' | 'transformer' | 'commander';
  classification: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
}

export default async function capabilityGenerator(tree: Tree, options: CapabilityGeneratorSchema) {
  assertKebabCase(options.name);
  assertKebabCase(options.domain);
  if (options.subdomain) assertKebabCase(options.subdomain);

  const fileName = options.name;
  const base = toCamelCase(fileName);
  const exportConstName = `${base}Capability`;
  const capId = `golden.${[options.domain, options.subdomain, fileName]
    .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    .join('.')}`;
  const folder = `${options.pattern}s`;
  const moduleBase = `${folder}/${fileName}.capability`;

  const capPath = `packages/capabilities/src/${moduleBase}.ts`;
  if (!tree.exists(capPath)) {
    const file = `/**
 * packages/capabilities/src/${moduleBase}.ts
 * Generated OCS capability (${options.pattern}) (GSS-001 / OCS-001).
 *
 * TODO: Replace placeholder schemas and factory.
 */
import { z } from '@golden/schema-registry';
import type { Capability, CapabilityContext } from '@golden/core';

const inputSchema = z.object({}).describe('${exportConstName} input');
const outputSchema = z.object({}).describe('${exportConstName} output');
const configSchema = z.object({}).describe('${exportConstName} config');
const secretsSchema = z.object({}).describe('${exportConstName} secrets (keys only)');

export type ${base}Input = z.infer<typeof inputSchema>;
export type ${base}Output = z.infer<typeof outputSchema>;
export type ${base}Config = z.infer<typeof configSchema>;
export type ${base}Secrets = z.infer<typeof secretsSchema>;

export const ${exportConstName}: Capability<${base}Input, ${base}Output, ${base}Config, ${base}Secrets> = {
  metadata: {
    id: '${capId}',
    version: '1.0.0',
    name: '${base}',
    description: 'TODO: Describe what this capability does (purpose, not effect).',
    domain: '${options.domain}',
    ${options.subdomain ? `subdomain: '${options.subdomain}',` : ''}
    tags: [
      '${options.domain}',
      ${options.subdomain ? `'${options.subdomain}',` : ''}
      'generated',
      '${options.pattern.toLowerCase()}',
    ].filter(Boolean) as string[],
    maintainer: 'platform',
  },
  schemas: {
    input: inputSchema,
    output: outputSchema,
    config: configSchema,
    secrets: secretsSchema,
  },
  security: {
    requiredScopes: [],
    dataClassification: '${options.classification}',
    networkAccess: {
      // Explicit allowOutbound required by OCS/ISS (can be empty, but must be explicit).
      allowOutbound: [],
    },
  },
  operations: {
    isIdempotent: true,
    retryPolicy: { maxAttempts: 1, initialIntervalSeconds: 1, backoffCoefficient: 1 },
    errorMap: () => 'FATAL',
    costFactor: 'LOW',
  },
  aiHints: { exampleInput: {}, exampleOutput: {} },
  factory: (dag, context: CapabilityContext<${base}Config, ${base}Secrets>, input: ${base}Input) => {
    void context;
    void input;
    // Dagger client is provided by the worker at runtime.
    type ContainerBuilder = {
      from(image: string): ContainerBuilder;
      withExec(args: string[]): unknown;
    };
    type DaggerClient = { container(): ContainerBuilder };
    const d = dag as unknown as DaggerClient;
    return d.container().from('node:20-alpine').withExec([
      'node',
      '-e',
      'process.stdout.write(JSON.stringify({}))',
    ]);
  },
};
`;
    tree.write(capPath, file);
  }

  const testPath = `packages/capabilities/src/${folder}/${fileName}.capability.test.ts`;
  if (!tree.exists(testPath)) {
    tree.write(
      testPath,
      `/**
 * packages/capabilities/src/${folder}/${fileName}.capability.test.ts
 * TCS-001 contract verification for generated capability.
 */
import { describe, it, expect } from 'vitest';
import { ${exportConstName} } from './${fileName}.capability.js';

describe('${exportConstName}', () => {
  it('validates aiHints examples against schemas', () => {
    expect(() => ${exportConstName}.schemas.input.parse(${exportConstName}.aiHints.exampleInput)).not.toThrow();
    expect(() => ${exportConstName}.schemas.output.parse(${exportConstName}.aiHints.exampleOutput)).not.toThrow();
  });
});
`
    );
  }

  upsertCapabilitiesIndexExport(tree, moduleBase, exportConstName);
  updateCapabilityRegistry(tree, moduleBase, exportConstName, capId);

  return () => {};
}

