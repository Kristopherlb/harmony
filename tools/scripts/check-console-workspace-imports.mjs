/**
 * tools/scripts/check-console-workspace-imports.mjs
 *
 * Purpose:
 * - Guardrail for ESM interop in Console server: forbid default imports from
 *   internal workspace packages (`@golden/*`).
 *
 * Why:
 * - Default imports from workspace packages can resolve to `undefined` in some
 *   TS/ESM/Vitest contexts.
 * - Standard: use namespace imports: `import * as blueprints from '@golden/blueprints'`.
 *
 * Usage:
 * - node tools/scripts/check-console-workspace-imports.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const repoRoot = path.resolve(process.cwd());
const targetDir = path.join(repoRoot, 'packages', 'apps', 'console', 'server');

function walk(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist') continue;
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (st.isFile() && (name.endsWith('.ts') || name.endsWith('.tsx'))) out.push(full);
  }
  return out;
}

function isGoldenWorkspaceImport(text) {
  return typeof text === 'string' && text.startsWith('@golden/');
}

function main() {
  if (!fs.existsSync(targetDir)) {
    throw new Error(`Target directory missing: ${targetDir}`);
  }

  const offenders = [];
  const files = walk(targetDir);

  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    for (const stmt of sf.statements) {
      if (!ts.isImportDeclaration(stmt)) continue;
      if (!ts.isStringLiteral(stmt.moduleSpecifier)) continue;
      if (!isGoldenWorkspaceImport(stmt.moduleSpecifier.text)) continue;
      const clause = stmt.importClause;
      if (!clause?.name) continue; // default import exists

      const { line, character } = sf.getLineAndCharacterOfPosition(stmt.getStart(sf));
      offenders.push({
        file,
        line: line + 1,
        col: character + 1,
        module: stmt.moduleSpecifier.text,
        importedAs: clause.name.text,
      });
    }
  }

  if (offenders.length === 0) {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ ok: true, offenders: 0 }));
    return;
  }

  // eslint-disable-next-line no-console
  console.error(
    JSON.stringify({
      ok: false,
      offenders,
      message:
        "Console server must not use default imports from '@golden/*'. Use namespace imports (import * as pkg from '@golden/pkg').",
      codemod: 'node tools/codemods/console-fix-golden-default-imports.mjs',
    })
  );
  process.exit(2);
}

main();

