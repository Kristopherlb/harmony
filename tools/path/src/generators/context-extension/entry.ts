import type { Tree } from '@nx/devkit';
import ts from 'typescript';

type FieldType = 'string' | 'number' | 'boolean' | 'string[]' | 'unknown';

function assertKebabCase(value: string): void {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    throw new Error(`Invalid name (expected kebab-case): ${value}`);
  }
}

function assertFieldName(value: string): void {
  if (!/^[a-z0-9_]+$/.test(value)) {
    throw new Error(`Invalid field name (expected snake_case): ${value}`);
  }
}

function toCamelCase(kebab: string): string {
  const [first, ...rest] = kebab.split('-');
  return [first, ...rest.map((p) => p.slice(0, 1).toUpperCase() + p.slice(1))].join('');
}

function toPascalCase(kebab: string): string {
  const c = toCamelCase(kebab);
  return c.slice(0, 1).toUpperCase() + c.slice(1);
}

function toTitleCase(kebab: string): string {
  return kebab
    .split('-')
    .filter((p) => p.trim().length > 0)
    .map((p) => p.slice(0, 1).toUpperCase() + p.slice(1))
    .join(' ');
}

function normalizeFieldType(value: string): FieldType {
  switch (value.trim()) {
    case 'string':
      return 'string';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'string[]':
      return 'string[]';
    default:
      return 'unknown';
  }
}

function zodForField(kind: FieldType, optional: boolean): string {
  const base = (() => {
    switch (kind) {
      case 'string':
        return 'z.string()';
      case 'number':
        return 'z.number()';
      case 'boolean':
        return 'z.boolean()';
      case 'string[]':
        return 'z.array(z.string())';
      default:
        return 'z.unknown()';
    }
  })();
  return optional ? `${base}.optional()` : base;
}

function tsTypeForField(kind: FieldType): string {
  switch (kind) {
    case 'string':
      return 'string';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'string[]':
      return 'string[]';
    default:
      return 'unknown';
  }
}

function upsertLine(tree: Tree, path: string, line: string): void {
  if (!tree.exists(path)) return;
  const current = tree.read(path, 'utf-8') ?? '';
  if (current.includes(line)) return;
  tree.write(path, current.trimEnd() + '\n' + line + '\n');
}

function findVariableDeclaration(sf: ts.SourceFile, name: string): ts.VariableDeclaration | undefined {
  for (const stmt of sf.statements) {
    if (!ts.isVariableStatement(stmt)) continue;
    for (const decl of stmt.declarationList.declarations) {
      if (ts.isIdentifier(decl.name) && decl.name.text === name) return decl;
    }
  }
  return undefined;
}

function findCallExpressionInChain(
  expr: ts.Expression,
  predicate: (call: ts.CallExpression) => boolean
): ts.CallExpression | undefined {
  if (ts.isCallExpression(expr)) {
    if (predicate(expr)) return expr;
    const callee = expr.expression;
    if (ts.isPropertyAccessExpression(callee) && ts.isCallExpression(callee.expression)) {
      return findCallExpressionInChain(callee.expression, predicate);
    }
  }
  return undefined;
}

function unwrapExpression(expr: ts.Expression): ts.Expression {
  let e: ts.Expression = expr;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (ts.isParenthesizedExpression(e)) {
      e = e.expression;
      continue;
    }
    if (ts.isAsExpression(e)) {
      e = e.expression;
      continue;
    }
    if (ts.isTypeAssertionExpression(e)) {
      e = e.expression;
      continue;
    }
    return e;
  }
}

function findZodObjectLiteral(sf: ts.SourceFile, varName: string): ts.ObjectLiteralExpression {
  const decl = findVariableDeclaration(sf, varName);
  if (!decl?.initializer) throw new Error(`Unsupported format (missing initializer): ${varName}`);

  const call = findCallExpressionInChain(unwrapExpression(decl.initializer), (c) => {
    const callee = c.expression;
    if (!ts.isPropertyAccessExpression(callee)) return false;
    if (callee.name.text !== 'object') return false;
    if (!ts.isIdentifier(callee.expression) || callee.expression.text !== 'z') return false;
    return c.arguments.length > 0 && ts.isObjectLiteralExpression(c.arguments[0]!);
  });
  if (!call) throw new Error(`Unsupported format (missing z.object({...}) call): ${varName}`);

  const obj = call.arguments[0];
  if (!ts.isObjectLiteralExpression(obj)) throw new Error(`Unsupported format (expected object literal): ${varName}`);
  return obj;
}

function lastNonWhitespaceChar(source: string, beforeIdx: number): string | undefined {
  for (let i = beforeIdx - 1; i >= 0; i--) {
    const ch = source[i];
    if (ch == null) return undefined;
    if (ch !== ' ' && ch !== '\t' && ch !== '\n' && ch !== '\r') return ch;
  }
  return undefined;
}

function insertBefore(source: string, idx: number, insert: string): string {
  return source.slice(0, idx) + insert + source.slice(idx);
}

function objectHasProperty(obj: ts.ObjectLiteralExpression, name: string): boolean {
  return obj.properties.some((p) => {
    if (!ts.isPropertyAssignment(p) && !ts.isShorthandPropertyAssignment(p)) return false;
    const n = p.name;
    if (!n) return false;
    if (ts.isIdentifier(n)) return n.text === name;
    if (ts.isStringLiteral(n)) return n.text === name;
    return false;
  });
}

function extendGoldenContextSchema(tree: Tree, domainTitle: string, fields: Array<{ name: string; zod: string }>): void {
  const path = 'packages/core/src/context/golden-context.ts';
  if (!tree.exists(path)) throw new Error(`Missing file: ${path}`);
  const current = tree.read(path, 'utf-8') ?? '';

  const sf = ts.createSourceFile(path, current, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const obj = findZodObjectLiteral(sf, 'goldenContextSchema');

  const missing = fields.filter((f) => !objectHasProperty(obj, f.name));
  if (missing.length === 0) return;

  const insertPos = obj.getEnd() - 1; // just before "}"
  if (current[insertPos] !== '}') {
    throw new Error(`Unsupported golden-context format (object literal did not end with "}"): ${path}`);
  }

  const needsComma = (() => {
    const ch = lastNonWhitespaceChar(current, insertPos);
    return ch != null && ch !== '{' && ch !== ',';
  })();

  const marker = `  // ${domainTitle} fields (optional - generated by @golden/path:context-extension)`;
  const lines = [
    '',
    marker,
    ...missing
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((f) => `  ${f.name}: ${f.zod},`),
    '',
  ].join('\n');

  const insert = (needsComma ? ',' : '') + lines;
  tree.write(path, insertBefore(current, insertPos, insert));
}

function extendGoldenSpanAttributesObject(
  tree: Tree,
  fields: Array<{ name: string; attrKey: string }>
): { source: string; changed: boolean } {
  const path = 'packages/core/src/observability/golden-span.ts';
  if (!tree.exists(path)) throw new Error(`Missing file: ${path}`);
  const current = tree.read(path, 'utf-8') ?? '';
  const sf = ts.createSourceFile(path, current, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const decl = findVariableDeclaration(sf, 'GOLDEN_ATTRIBUTES');
  const init = decl?.initializer ? unwrapExpression(decl.initializer) : undefined;
  if (!init || !ts.isObjectLiteralExpression(init)) {
    throw new Error(`Unsupported golden-span format (missing GOLDEN_ATTRIBUTES object literal): ${path}`);
  }

  const obj = init;
  const missingConsts = fields.filter((f) => !objectHasProperty(obj, f.attrKey));
  if (missingConsts.length === 0) return { source: current, changed: false };

  const insertPos = obj.getEnd() - 1;
  if (current[insertPos] !== '}') {
    throw new Error(`Unsupported golden-span format (attributes object did not end with "}"): ${path}`);
  }

  const needsComma = (() => {
    const ch = lastNonWhitespaceChar(current, insertPos);
    return ch != null && ch !== '{' && ch !== ',';
  })();

  const constLines = missingConsts
    .slice()
    .sort((a, b) => a.attrKey.localeCompare(b.attrKey))
    .map((f) => `  ${f.attrKey}: 'golden.${f.name}',`);

  const insert = (needsComma ? ',' : '') + '\n' + constLines.join('\n') + '\n';
  return { source: insertBefore(current, insertPos, insert), changed: true };
}

function extendGoldenSpanAssignments(
  source: string,
  fields: Array<{ name: string; attrKey: string; kind: FieldType }>
): string {
  const sf = ts.createSourceFile('packages/core/src/observability/golden-span.ts', source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);

  const fn = sf.statements.find((s) => ts.isFunctionDeclaration(s) && s.name?.text === 'getGoldenSpanAttributes');
  if (!fn || !ts.isFunctionDeclaration(fn) || !fn.body) return source;

  const returnStmt = fn.body.statements.find(
    (s) => ts.isReturnStatement(s) && s.expression && ts.isIdentifier(s.expression) && s.expression.text === 'attrs'
  );
  if (!returnStmt) return source;

  const insertPos = returnStmt.getStart(sf);

  const blocks = fields
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((f) => {
      const valExpr = (() => {
        switch (f.kind) {
          case 'boolean':
            return `(ctx as any)[${JSON.stringify(f.name)}] as boolean`;
          case 'string[]':
            return `String(((ctx as any)[${JSON.stringify(f.name)}] as string[]).join(','))`;
          default:
            return `String((ctx as any)[${JSON.stringify(f.name)}])`;
        }
      })();
      return `  if ((ctx as any)[${JSON.stringify(f.name)}] != null) {\n    attrs[GOLDEN_ATTRIBUTES.${f.attrKey}] = ${valExpr};\n  }`;
    })
    .join('\n\n');

  if (blocks.trim().length === 0) return source;
  if (source.includes(blocks)) return source;

  const insert = `\n  // Generated domain attributes (GOS-001)\n${blocks}\n\n`;
  return insertBefore(source, insertPos, insert);
}

function extendGoldenSpan(tree: Tree, fields: Array<{ name: string; attrKey: string; kind: FieldType }>): void {
  const path = 'packages/core/src/observability/golden-span.ts';
  const { source: withConsts, changed } = extendGoldenSpanAttributesObject(
    tree,
    fields.map((f) => ({ name: f.name, attrKey: f.attrKey }))
  );
  const withAssignments = extendGoldenSpanAssignments(withConsts, fields);
  if (changed || withAssignments !== withConsts) tree.write(path, withAssignments);
}

export interface ContextExtensionFieldSchema {
  name: string;
  type: string;
  optional?: boolean;
}

export interface ContextExtensionGeneratorSchema {
  name: string;
  fields: Array<ContextExtensionFieldSchema | string>;
}

export default async function contextExtensionGenerator(tree: Tree, options: ContextExtensionGeneratorSchema) {
  assertKebabCase(options.name);
  if (!Array.isArray(options.fields) || options.fields.length === 0) {
    throw new Error('fields must be a non-empty array');
  }

  const domain = options.name;
  const domainTitle = toTitleCase(domain);
  const domainPascal = toPascalCase(domain);

  const normalized = options.fields.map((raw) => {
    const f: ContextExtensionFieldSchema =
      typeof raw === 'string'
        ? (() => {
            const [name, type, flag] = raw.split(':').map((x) => x.trim());
            if (!name || !type) throw new Error(`Invalid field spec: ${raw}`);
            const optional = flag ? !['required', 'false', '0'].includes(flag.toLowerCase()) : true;
            return { name, type, optional };
          })()
        : raw;

    assertFieldName(f.name);
    const kind = normalizeFieldType(f.type);
    const optional = f.optional ?? true;
    return {
      name: f.name,
      kind,
      optional,
      zod: zodForField(kind, optional),
      tsType: tsTypeForField(kind),
      attrKey: f.name.toUpperCase(),
    };
  });

  extendGoldenContextSchema(
    tree,
    domainTitle,
    normalized.map((f) => ({ name: f.name, zod: f.zod }))
  );
  extendGoldenSpan(
    tree,
    normalized.map((f) => ({ name: f.name, attrKey: f.attrKey, kind: f.kind }))
  );

  const helperPath = `packages/core/src/context/${domain}-context.ts`;
  const helperTestPath = `packages/core/src/context/${domain}-context.test.ts`;

  const sorted = normalized.slice().sort((a, b) => a.name.localeCompare(b.name));
  const presenceField = sorted[0]?.name ?? '';

  if (!tree.exists(helperPath)) {
    const ifaceLines = sorted.map((f) => `  ${f.name}${f.optional ? '?' : ''}: ${f.tsType};`);
    const extractLines = sorted.map(
      (f) =>
        `  if ((ctx as any)[${JSON.stringify(f.name)}] != null) out[${JSON.stringify(f.name)}] = (ctx as any)[${JSON.stringify(
          f.name
        )}];`
    );

    const helperSource = [
      `/**`,
      ` * ${helperPath}`,
      ` * Generated GoldenContext helper module for ${domainTitle} domain fields.`,
      ` */`,
      `import type { GoldenContext } from './golden-context.js';`,
      ``,
      `export interface ${domainPascal}Context {`,
      ...ifaceLines,
      `}`,
      ``,
      `export function create${domainPascal}GoldenContext(base: GoldenContext, ext: ${domainPascal}Context): GoldenContext {`,
      `  return { ...base, ...ext };`,
      `}`,
      ``,
      `export function has${domainPascal}Context(ctx: GoldenContext): boolean {`,
      `  return (ctx as any)[${JSON.stringify(presenceField)}] != null;`,
      `}`,
      ``,
      `export function extract${domainPascal}Context(ctx: GoldenContext): ${domainPascal}Context | undefined {`,
      `  if (!has${domainPascal}Context(ctx)) return undefined;`,
      `  const out: Partial<${domainPascal}Context> = {};`,
      ...extractLines,
      `  return out as ${domainPascal}Context;`,
      `}`,
      ``,
    ].join('\n');

    tree.write(helperPath, helperSource);
  }

  if (!tree.exists(helperTestPath)) {
    const first = sorted[0];
    const sample =
      first?.kind === 'number'
        ? '1'
        : first?.kind === 'boolean'
          ? 'true'
          : first?.kind === 'string[]'
            ? "['a']"
            : "'v'";

    const helperTest = [
      `/**`,
      ` * ${helperTestPath}`,
      ` * Unit tests for generated GoldenContext helper module.`,
      ` */`,
      `import { describe, it, expect } from 'vitest';`,
      `import { goldenContextSchema } from './golden-context';`,
      `import { create${domainPascal}GoldenContext, has${domainPascal}Context, extract${domainPascal}Context } from './${domain}-context';`,
      ``,
      `describe('${domain}-context', () => {`,
      `  it('round-trips domain fields through GoldenContext', () => {`,
      `    const base = goldenContextSchema.parse({ app_id: 'app', environment: 'test', initiator_id: 'u', trace_id: 't' });`,
      `    const merged = create${domainPascal}GoldenContext(base, { ${first?.name ?? 'x'}: ${sample} } as any);`,
      `    expect(has${domainPascal}Context(merged)).toBe(true);`,
      `    expect(extract${domainPascal}Context(merged)).toBeDefined();`,
      `  });`,
      `});`,
      ``,
    ].join('\n');

    tree.write(helperTestPath, helperTest);
  }

  upsertLine(tree, 'packages/core/src/index.ts', `export * from './context/${domain}-context.js';`);
  return () => {};
}

