/**
 * packages/core/src/utils/repo-root.ts
 *
 * Purpose: Resolve the monorepo root directory in a runner/cwd-independent way.
 * Used by tests and tooling that need to read repo-root artifacts (e.g. `policies/*`).
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function hasRepoMarkers(dir: string): boolean {
  return (
    existsSync(path.join(dir, 'nx.json')) &&
    existsSync(path.join(dir, 'pnpm-workspace.yaml')) &&
    existsSync(path.join(dir, 'package.json'))
  );
}

/**
 * Resolve repo root by walking upward from this module until monorepo markers are found.
 */
export function getRepoRoot(): string {
  const start = path.dirname(fileURLToPath(import.meta.url));
  let cur = start;

  for (let i = 0; i < 12; i++) {
    if (hasRepoMarkers(cur)) return cur;
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }

  throw new Error(`Failed to resolve repo root from: ${start}`);
}

