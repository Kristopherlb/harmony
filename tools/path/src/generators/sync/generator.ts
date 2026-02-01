/**
 * tools/path/src/generators/sync/generator.ts
 * Regenerate registries and barrel exports deterministically from filesystem discovery (GSS-001).
 */
import type { Tree } from '@nx/devkit';
import ts from 'typescript';

type CapabilityDiscovered = {
  moduleBase: string; // e.g. demo/echo.capability
  exportName: string; // e.g. echoCapability
  metadataId: string; // e.g. golden.echo
  exportedTypes: string[]; // exported type/interface names
};

type BlueprintDescriptorDiscovered = {
  fileBase: string; // e.g. echo.descriptor
  exportName: string; // e.g. echoBlueprintDescriptor
  blueprintId: string; // e.g. workflows.echo
  workflowType: string; // e.g. echoWorkflow
};

type WorkflowRunDiscovered = {
  relModulePath: string; // e.g. echo.workflow-run OR system/execute-capability.workflow-run
  exportName: string; // e.g. echoWorkflow
};

export interface SyncGeneratorSchema {}

function unwrapExpression(expr: ts.Expression): ts.Expression {
  let cur: ts.Expression = expr;
  // eslint-disable-next-line no-constant-condition -- iterative unwrap
  while (true) {
    if (ts.isAsExpression(cur)) {
      cur = cur.expression;
      continue;
    }
    if (ts.isParenthesizedExpression(cur)) {
      cur = cur.expression;
      continue;
    }
    // TS 5.3 supports satisfies operator in AST.
    if (ts.isSatisfiesExpression(cur)) {
      cur = cur.expression;
      continue;
    }
    return cur;
  }
}

function getStringLiteral(expr: ts.Expression): string | undefined {
  if (ts.isStringLiteral(expr)) return expr.text;
  if (ts.isNoSubstitutionTemplateLiteral(expr)) return expr.text;
  return undefined;
}

function getObjectLiteralProperty(obj: ts.ObjectLiteralExpression, name: string): ts.Expression | undefined {
  for (const prop of obj.properties) {
    if (!ts.isPropertyAssignment(prop)) continue;
    if (ts.isIdentifier(prop.name) && prop.name.text === name) return prop.initializer;
    if (ts.isStringLiteral(prop.name) && prop.name.text === name) return prop.initializer;
  }
  return undefined;
}

function extractMetadataIdFromInitializer(initializer: ts.Expression | undefined): string | undefined {
  if (!initializer) return undefined;
  const unwrapped = unwrapExpression(initializer);
  if (!ts.isObjectLiteralExpression(unwrapped)) return undefined;
  const metadataExpr = getObjectLiteralProperty(unwrapped, 'metadata');
  if (!metadataExpr) return undefined;
  const metaUnwrapped = unwrapExpression(metadataExpr);
  if (!ts.isObjectLiteralExpression(metaUnwrapped)) return undefined;
  const idExpr = getObjectLiteralProperty(metaUnwrapped, 'id');
  if (!idExpr) return undefined;
  return getStringLiteral(unwrapExpression(idExpr));
}

function extractBlueprintDescriptorFieldsFromInitializer(
  initializer: ts.Expression | undefined
): { blueprintId?: string; workflowType?: string } {
  if (!initializer) return {};
  const unwrapped = unwrapExpression(initializer);
  if (!ts.isObjectLiteralExpression(unwrapped)) return {};
  const blueprintIdExpr = getObjectLiteralProperty(unwrapped, 'blueprintId');
  const workflowTypeExpr = getObjectLiteralProperty(unwrapped, 'workflowType');
  return {
    blueprintId: blueprintIdExpr ? getStringLiteral(unwrapExpression(blueprintIdExpr)) : undefined,
    workflowType: workflowTypeExpr ? getStringLiteral(unwrapExpression(workflowTypeExpr)) : undefined,
  };
}

function readUtf8(tree: Tree, path: string): string {
  const buf = tree.read(path);
  if (!buf) throw new Error(`Missing file: ${path}`);
  return buf.toString('utf-8');
}

function listFilesRecursive(tree: Tree, dir: string): string[] {
  if (!tree.exists(dir)) return [];
  const out: string[] = [];
  const children = tree.children(dir);
  for (const child of children) {
    const full = `${dir}/${child}`;
    const buf = tree.read(full);
    if (buf) out.push(full);
    else out.push(...listFilesRecursive(tree, full));
  }
  return out;
}

function discoverCapabilities(tree: Tree): CapabilityDiscovered[] {
  const root = 'packages/capabilities/src';
  const files = listFilesRecursive(tree, root).filter((p) => p.endsWith('.capability.ts'));

  const out: CapabilityDiscovered[] = [];
  for (const absPath of files) {
    const source = readUtf8(tree, absPath);
    const sf = ts.createSourceFile(absPath, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);

    const localToMetaId = new Map<string, string>();
    const exportedTypes = new Set<string>();

    for (const stmt of sf.statements) {
      if (ts.isInterfaceDeclaration(stmt) || ts.isTypeAliasDeclaration(stmt)) {
        const isExported = stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
        if (isExported && stmt.name) exportedTypes.add(stmt.name.text);
      }

      if (ts.isVariableStatement(stmt)) {
        for (const decl of stmt.declarationList.declarations) {
          if (!ts.isIdentifier(decl.name)) continue;
          const id = extractMetadataIdFromInitializer(decl.initializer);
          if (id) localToMetaId.set(decl.name.text, id);
        }
      }
    }

    const exportedCaps: Array<{ exportName: string; localName: string; metadataId: string }> = [];

    for (const stmt of sf.statements) {
      if (ts.isVariableStatement(stmt)) {
        const isExported = stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
        if (!isExported) continue;
        for (const decl of stmt.declarationList.declarations) {
          if (!ts.isIdentifier(decl.name)) continue;
          const localName = decl.name.text;
          const metadataId = localToMetaId.get(localName);
          if (metadataId) exportedCaps.push({ exportName: localName, localName, metadataId });
        }
      }

      if (ts.isExportDeclaration(stmt) && stmt.exportClause && ts.isNamedExports(stmt.exportClause)) {
        for (const el of stmt.exportClause.elements) {
          const localName = el.propertyName?.text ?? el.name.text;
          const exportName = el.name.text;
          const metadataId = localToMetaId.get(localName);
          if (metadataId) exportedCaps.push({ exportName, localName, metadataId });
        }
      }
    }

    if (exportedCaps.length === 0) continue;
    if (exportedCaps.length > 1) {
      throw new Error(`Multiple capability exports with metadata found in one file (unsupported): ${absPath}`);
    }

    const { exportName, metadataId } = exportedCaps[0]!;
    const moduleBase = absPath.slice(`${root}/`.length).replace(/\.ts$/, '');
    out.push({ moduleBase, exportName, metadataId, exportedTypes: Array.from(exportedTypes).sort() });
  }

  return out.sort((a, b) => a.metadataId.localeCompare(b.metadataId));
}

function regenerateCapabilityRegistry(tree: Tree, caps: CapabilityDiscovered[]): void {
  const registryPath = 'packages/capabilities/src/registry.ts';
  if (!tree.exists(registryPath)) return;

  const importLines = caps.map((c) => `import { ${c.exportName} } from './${c.moduleBase}.js';`);
  const entryLines = caps.map(
    (c) => `    [${c.exportName}.metadata.id, ${c.exportName} as unknown as Capability<unknown, unknown, unknown, unknown>],`
  );

  tree.write(
    registryPath,
    `/**
 * packages/capabilities/src/registry.ts
 * In-process registry for OCS capabilities by ID.
 *
 * Generated by @golden/path:sync (deterministic).
 */
import type { Capability } from '@golden/core';
${importLines.join('\n')}

export type CapabilityRegistry = Map<string, Capability<unknown, unknown, unknown, unknown>>;

export function createCapabilityRegistry(): CapabilityRegistry {
  return new Map([
${entryLines.join('\n')}
  ]);
}

export function getCapability(
  registry: CapabilityRegistry,
  capId: string
): Capability<unknown, unknown, unknown, unknown> {
  const cap = registry.get(capId);
  if (!cap) throw new Error(\`Capability not found: \${capId}\`);
  return cap;
}
`
  );
}

function regenerateCapabilitiesIndex(tree: Tree, caps: CapabilityDiscovered[]): void {
  const indexPath = 'packages/capabilities/index.ts';
  if (!tree.exists(indexPath)) return;

  const capLines = caps.map((c) => {
    const types = c.exportedTypes.filter((t) => t.endsWith('Input') || t.endsWith('Output'));
    const typePart = types.map((t) => `, type ${t}`).join('');
    return `export { ${c.exportName}${typePart} } from './src/${c.moduleBase}.js';`;
  });

  tree.write(
    indexPath,
    `/**
 * @golden/capabilities
 * Concrete OCS capabilities.
 *
 * Generated by @golden/path:sync (deterministic).
 */
${capLines.join('\n')}
export { createCapabilityRegistry, getCapability, type CapabilityRegistry } from './src/registry.js';
`
  );
}

function discoverBlueprintDescriptors(tree: Tree): BlueprintDescriptorDiscovered[] {
  const root = 'packages/blueprints/src/descriptors';
  const files = listFilesRecursive(tree, root).filter((p) => p.endsWith('.descriptor.ts'));

  const out: BlueprintDescriptorDiscovered[] = [];
  for (const absPath of files) {
    const source = readUtf8(tree, absPath);
    const sf = ts.createSourceFile(absPath, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);

    const localToFields = new Map<string, { blueprintId: string; workflowType: string }>();
    for (const stmt of sf.statements) {
      if (!ts.isVariableStatement(stmt)) continue;
      for (const decl of stmt.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name)) continue;
        const fields = extractBlueprintDescriptorFieldsFromInitializer(decl.initializer);
        if (fields.blueprintId && fields.workflowType) {
          localToFields.set(decl.name.text, { blueprintId: fields.blueprintId, workflowType: fields.workflowType });
        }
      }
    }

    const exportedDescs: Array<{ exportName: string; localName: string; blueprintId: string; workflowType: string }> = [];
    for (const stmt of sf.statements) {
      if (ts.isVariableStatement(stmt)) {
        const isExported = stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
        if (!isExported) continue;
        for (const decl of stmt.declarationList.declarations) {
          if (!ts.isIdentifier(decl.name)) continue;
          const localName = decl.name.text;
          const fields = localToFields.get(localName);
          if (fields) exportedDescs.push({ exportName: localName, localName, ...fields });
        }
      }

      if (ts.isExportDeclaration(stmt) && stmt.exportClause && ts.isNamedExports(stmt.exportClause)) {
        for (const el of stmt.exportClause.elements) {
          const localName = el.propertyName?.text ?? el.name.text;
          const exportName = el.name.text;
          const fields = localToFields.get(localName);
          if (fields) exportedDescs.push({ exportName, localName, ...fields });
        }
      }
    }

    if (exportedDescs.length === 0) continue;
    if (exportedDescs.length > 1) {
      throw new Error(`Multiple descriptor exports found in one file (unsupported): ${absPath}`);
    }

    const d = exportedDescs[0]!;
    const fileBase = absPath.slice(`${root}/`.length).replace(/\.ts$/, '');
    out.push({ fileBase, exportName: d.exportName, blueprintId: d.blueprintId, workflowType: d.workflowType });
  }

  return out.sort((a, b) => a.blueprintId.localeCompare(b.blueprintId));
}

function regenerateBlueprintRegistry(tree: Tree, descs: BlueprintDescriptorDiscovered[]): void {
  const registryPath = 'packages/blueprints/src/registry.ts';
  if (!tree.exists(registryPath)) return;

  const importLines = descs.map((d) => `import { ${d.exportName} } from './descriptors/${d.fileBase}.js';`);
  const entryLines = descs.map(
    (d) =>
      `    ['${d.blueprintId}', { blueprintId: '${d.blueprintId}', workflowType: '${d.workflowType}', descriptor: ${d.exportName} }],`
  );

  tree.write(
    registryPath,
    `/**
 * packages/blueprints/src/registry.ts
 * In-process registry for WCS blueprints by ID (deterministic discovery).
 *
 * Generated by @golden/path:sync (deterministic).
 */
${importLines.join('\n')}
import type { BlueprintDescriptor } from './descriptors/types.js';

export interface BlueprintRegistryEntry {
  blueprintId: string;
  workflowType: string;
  descriptor: BlueprintDescriptor;
}

export type BlueprintRegistry = Map<string, BlueprintRegistryEntry>;

export function createBlueprintRegistry(): BlueprintRegistry {
  // Deterministic ordering: sorted by blueprintId.
  return new Map<string, BlueprintRegistryEntry>([
${entryLines.join('\n')}
  ]);
}

export function getBlueprint(registry: BlueprintRegistry, blueprintId: string): BlueprintRegistryEntry {
  const bp = registry.get(blueprintId);
  if (!bp) throw new Error(\`Blueprint not found: \${blueprintId}\`);
  return bp;
}
`
  );
}

function discoverWorkflowRuns(tree: Tree): WorkflowRunDiscovered[] {
  const root = 'packages/blueprints/src/workflows';
  const files = listFilesRecursive(tree, root).filter((p) => p.endsWith('.workflow-run.ts'));

  const out: WorkflowRunDiscovered[] = [];
  for (const absPath of files) {
    if (absPath.endsWith('/index.ts')) continue;
    const source = readUtf8(tree, absPath);
    const sf = ts.createSourceFile(absPath, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);

    let exportName: string | undefined;
    for (const stmt of sf.statements) {
      if (!ts.isFunctionDeclaration(stmt)) continue;
      const isExported = stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
      if (!isExported) continue;
      if (!stmt.name) continue;
      exportName = stmt.name.text;
      break;
    }
    if (!exportName) continue;

    const relModulePath = absPath.slice(`${root}/`.length).replace(/\.ts$/, '');
    out.push({ relModulePath, exportName });
  }

  return out.sort((a, b) => a.exportName.localeCompare(b.exportName));
}

function regenerateWorkflowsIndex(tree: Tree, runs: WorkflowRunDiscovered[]): void {
  const indexPath = 'packages/blueprints/src/workflows/index.ts';
  if (!tree.exists(indexPath)) return;

  const lines = runs.map((r) => `export { ${r.exportName} } from './${r.relModulePath}';`);
  tree.write(
    indexPath,
    `/**
 * Workflow exports for Temporal worker bundle.
 *
 * Generated by @golden/path:sync (deterministic).
 */
${lines.join('\n')}
`
  );
}

export default async function syncGenerator(tree: Tree, _options: SyncGeneratorSchema) {
  const caps = discoverCapabilities(tree);
  regenerateCapabilityRegistry(tree, caps);
  regenerateCapabilitiesIndex(tree, caps);

  const descs = discoverBlueprintDescriptors(tree);
  regenerateBlueprintRegistry(tree, descs);

  const runs = discoverWorkflowRuns(tree);
  regenerateWorkflowsIndex(tree, runs);

  return () => {};
}

