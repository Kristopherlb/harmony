/**
 * packages/capabilities/src/dependency-hygiene.test.ts
 *
 * Purpose: deterministic guard for pnpm strictness.
 * Ensures any non-workspace runtime imports under `packages/capabilities/src/**`
 * are declared as direct dependencies in `packages/capabilities/package.json`.
 */
import { readdir, readFile } from 'node:fs/promises';
import { builtinModules } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

function capabilitiesRoot(): string {
  // src/ -> capabilities/ -> packages/capabilities
  return fileURLToPath(new URL('..', import.meta.url));
}

function repoRoot(): string {
  // packages/capabilities -> packages -> repo root
  return fileURLToPath(new URL('../../..', import.meta.url));
}

function isTestFile(path: string): boolean {
  return /\.test\.[cm]?[jt]sx?$/.test(path);
}

function isDistPath(path: string): boolean {
  return path.includes(`${join('packages', 'capabilities', 'dist')}${join('', '')}`) || path.includes('/dist/');
}

function isNodeBuiltin(spec: string): boolean {
  if (spec.startsWith('node:')) return true;
  return builtinModules.includes(spec);
}

function isWorkspaceImport(spec: string): boolean {
  return spec.startsWith('@golden/');
}

function packageRootFromSpecifier(spec: string): string {
  // scoped: @scope/name/.. -> @scope/name
  if (spec.startsWith('@')) {
    const parts = spec.split('/');
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : spec;
  }
  // unscoped: pkg/subpath -> pkg
  const [head] = spec.split('/');
  return head ?? spec;
}

async function listFilesRecursive(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'dist') continue;
      out.push(...(await listFilesRecursive(full)));
    } else if (e.isFile()) {
      out.push(full);
    }
  }
  return out;
}

function extractExternalImportsFromSource(sourceText: string, filePath: string): string[] {
  const sf = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const specs: string[] = [];

  const visit = (node: ts.Node) => {
    // import ... from 'x'
    if (ts.isImportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      specs.push(node.moduleSpecifier.text);
    }
    // export ... from 'x'
    if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      specs.push(node.moduleSpecifier.text);
    }
    // require('x')
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'require') {
      const [arg] = node.arguments;
      if (arg && ts.isStringLiteral(arg)) specs.push(arg.text);
    }
    ts.forEachChild(node, visit);
  };

  ts.forEachChild(sf, visit);

  return specs;
}

describe('dependency hygiene (pnpm strictness)', () => {
  it('requires all external runtime imports to be declared in packages/capabilities/package.json dependencies', async () => {
    const root = resolve(repoRoot(), 'packages', 'capabilities', 'src');
    const files = (await listFilesRecursive(root))
      .filter((p) => (p.endsWith('.ts') || p.endsWith('.tsx')) && !isTestFile(p) && !isDistPath(p));

    const pkgJsonPath = resolve(repoRoot(), 'packages', 'capabilities', 'package.json');
    const pkgRaw = await readFile(pkgJsonPath, 'utf8');
    const pkg = JSON.parse(pkgRaw) as { dependencies?: Record<string, string> };
    const deps = new Set(Object.keys(pkg.dependencies ?? {}));

    const missing = new Map<string, Set<string>>();

    for (const file of files) {
      const src = await readFile(file, 'utf8');
      const specs = extractExternalImportsFromSource(src, file);
      for (const spec of specs) {
        if (!spec) continue;
        if (spec.startsWith('.')) continue;
        if (isNodeBuiltin(spec)) continue;
        if (isWorkspaceImport(spec)) continue;
        const pkgRoot = packageRootFromSpecifier(spec);
        if (!deps.has(pkgRoot)) {
          const rel = file.slice(dirname(root).length + 1);
          if (!missing.has(pkgRoot)) missing.set(pkgRoot, new Set());
          missing.get(pkgRoot)!.add(rel);
        }
      }
    }

    if (missing.size > 0) {
      const lines = Array.from(missing.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .flatMap(([pkgName, locations]) => [
          `- ${pkgName}`,
          ...Array.from(locations)
            .sort()
            .map((p) => `  - ${p}`),
        ]);

      expect.fail(
        [
          'Missing direct dependencies in packages/capabilities/package.json for runtime imports:',
          ...lines,
          '',
          'Fix: add the missing packages to packages/capabilities/package.json dependencies.',
        ].join('\n')
      );
    }
  });
});

