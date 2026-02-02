/**
 * tools/scripts/regen-tool-catalog-and-sync.mjs
 *
 * Purpose: one-command deterministic discovery hygiene.
 *
 * Runs:
 * - pnpm -w nx run mcp-server:generate-tool-catalog
 * - pnpm -w nx g @golden/path:sync
 *
 * Usage:
 *   pnpm tools:regen-sync
 *
 * Notes:
 * - This script is intentionally simple and non-interactive.
 * - It keeps output visible to avoid “silent” drift.
 */
import { spawnSync } from 'node:child_process';

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: 'inherit' });
  if (r.error) throw r.error;
  return r.status ?? 0;
}

function main() {
  const status1 = run('pnpm', ['-w', 'nx', 'run', 'mcp-server:generate-tool-catalog']);
  if (status1 !== 0) process.exit(status1);

  const status2 = run('pnpm', ['-w', 'nx', 'g', '@golden/path:sync']);
  process.exit(status2);
}

main();

