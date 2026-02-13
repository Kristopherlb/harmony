/**
 * tools/codemods/console-fix-golden-default-imports.mjs
 *
 * Purpose:
 * - Fix ESM interop pitfalls in Console server by rewriting default imports
 *   from internal workspace packages (`@golden/*`) into namespace imports.
 *
 * Why:
 * - `import blueprints from '@golden/blueprints'` can resolve to `undefined`
 *   under certain TS/ESM/Vitest setups.
 * - Prefer: `import * as blueprints from '@golden/blueprints'`.
 *
 * Usage:
 * - Apply fixes:
 *   node tools/codemods/console-fix-golden-default-imports.mjs
 *
 * - Check only (no writes, exits non-zero if changes needed):
 *   node tools/codemods/console-fix-golden-default-imports.mjs --check
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

function isGoldenWorkspaceImport(moduleSpecifierText) {
  return typeof moduleSpecifierText === 'string' && moduleSpecifierText.startsWith('@golden/');
}

function transformSourceText(fileName, text) {
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });

  /** @type {ts.Statement[]} */
  const outStatements = [];
  let changed = false;

  for (const stmt of sf.statements) {
    if (!ts.isImportDeclaration(stmt)) {
      outStatements.push(stmt);
      continue;
    }

    const moduleText = ts.isStringLiteral(stmt.moduleSpecifier) ? stmt.moduleSpecifier.text : undefined;
    if (!isGoldenWorkspaceImport(moduleText)) {
      outStatements.push(stmt);
      continue;
    }

    const clause = stmt.importClause;
    if (!clause || !clause.name) {
      outStatements.push(stmt);
      continue;
    }

    const defaultIdent = clause.name;
    const namedBindings = clause.namedBindings;

    // Convert default import to namespace import.
    // - import foo from '@golden/x'            -> import * as foo from '@golden/x'
    // - import foo, { a } from '@golden/x'     -> import * as foo from '@golden/x'; import { a } from '@golden/x'
    const nsImport = ts.factory.createImportDeclaration(
      stmt.modifiers,
      ts.factory.createImportClause(false, undefined, ts.factory.createNamespaceImport(defaultIdent)),
      stmt.moduleSpecifier,
      stmt.assertClause
    );

    outStatements.push(nsImport);
    changed = true;

    if (namedBindings && ts.isNamedImports(namedBindings)) {
      const namedImport = ts.factory.createImportDeclaration(
        stmt.modifiers,
        ts.factory.createImportClause(false, undefined, namedBindings),
        stmt.moduleSpecifier,
        stmt.assertClause
      );
      outStatements.push(namedImport);
    }
  }

  if (!changed) return { changed: false, text };

  const newSf = ts.factory.updateSourceFile(sf, outStatements);
  const printed = printer.printFile(newSf);
  return { changed: true, text: printed };
}

function main() {
  const checkOnly = process.argv.includes('--check');
  if (!fs.existsSync(targetDir)) {
    throw new Error(`Target directory missing: ${targetDir}`);
  }

  const files = walk(targetDir);
  const changedFiles = [];

  for (const file of files) {
    const before = fs.readFileSync(file, 'utf8');
    const res = transformSourceText(file, before);
    if (!res.changed) continue;

    changedFiles.push(file);
    if (!checkOnly) fs.writeFileSync(file, res.text, 'utf8');
  }

  if (changedFiles.length === 0) {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ ok: true, changedFiles: 0 }));
    return;
  }

  if (checkOnly) {
    // eslint-disable-next-line no-console
    console.error(JSON.stringify({ ok: false, changedFiles, message: 'Default imports from @golden/* need fixing.' }));
    process.exit(2);
  }

  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ ok: true, changedFiles }));
}

main();

