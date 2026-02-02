/**
 * tools/scripts/check-registry-hygiene.mjs
 *
 * Purpose: Ensure tool-catalog.json is updated when capability/blueprint sources change.
 * Used by pre-commit hook (Phase 0.1) and can be run manually: node tools/scripts/check-registry-hygiene.mjs
 *
 * Logic:
 * - If any staged file is under packages/capabilities/ or packages/blueprints/, run regen-sync.
 * - If tool-catalog.json has uncommitted changes after regen, exit 1 with instructions.
 */
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const CATALOG_PATH = 'packages/tools/mcp-server/src/manifest/tool-catalog.json';
const REPO_ROOT = resolve(process.cwd());

function run(cmd, opts = {}) {
  return execSync(cmd, { encoding: 'utf8', cwd: REPO_ROOT, ...opts });
}

function getStagedFiles() {
  try {
    const out = run('git diff --cached --name-only');
    return out.trim() ? out.trim().split('\n') : [];
  } catch {
    return [];
  }
}

function affectsRegistry(files) {
  return files.some(
    (f) =>
      f.startsWith('packages/capabilities/') || f.startsWith('packages/blueprints/')
  );
}

function main() {
  const staged = getStagedFiles();
  if (!affectsRegistry(staged)) {
    process.exit(0);
  }

  // Regenerate tool catalog so it's up to date.
  try {
    run('pnpm tools:regen-sync', { stdio: 'inherit' });
  } catch (e) {
    console.error('Registry hygiene check: pnpm tools:regen-sync failed.');
    process.exit(1);
  }

  const catalogFullPath = resolve(REPO_ROOT, CATALOG_PATH);
  if (!existsSync(catalogFullPath)) {
    console.error(`Registry hygiene: ${CATALOG_PATH} missing after regen.`);
    process.exit(1);
  }

  try {
    run(`git diff --exit-code -- ${CATALOG_PATH}`);
  } catch {
    console.error('');
    console.error('Registry hygiene: tool catalog is out of date.');
    console.error('Capability/blueprint files changed; catalog must be committed.');
    console.error('');
    console.error('Run:');
    console.error(`  git add ${CATALOG_PATH}`);
    console.error('  then commit again.');
    console.error('');
    process.exit(1);
  }

  process.exit(0);
}

main();
