/**
 * packages/core/src/utils/repo-root.ts
 *
 * Purpose: Resolve the monorepo root directory in a runner/cwd-independent way.
 * Used by tests and tooling that need to read repo-root artifacts (e.g. `policies/*`).
 */
import { existsSync } from 'node:fs';
import path from 'node:path';

function hasRepoMarkers(dir: string): boolean {
  return (
    existsSync(path.join(dir, 'nx.json')) &&
    existsSync(path.join(dir, 'pnpm-workspace.yaml')) &&
    existsSync(path.join(dir, 'package.json'))
  );
}

/**
 * Resolve repo root by walking upward from a few safe starting points.
 *
 * Notes:
 * - We intentionally avoid `import.meta.url` so this file can compile to CJS under TS NodeNext rules.
 * - `typeof __dirname` is safe in ESM (returns 'undefined' without throwing).
 */
export function getRepoRoot(): string {
  const candidates: string[] = [];

  // Prefer explicit override when running in atypical environments (optional).
  const envRoot = process.env.HARMONY_REPO_ROOT;
  if (envRoot && envRoot.trim()) candidates.push(envRoot);

  // CJS: module directory. ESM: this evaluates to false safely.
  // eslint-disable-next-line no-undef
  if (typeof __dirname !== 'undefined') {
    // eslint-disable-next-line no-undef
    candidates.push(__dirname);
  }

  // Current working directory (often repo root, but not always).
  candidates.push(process.cwd());

  // Entry-point directory (often inside the repo even when cwd is not).
  if (process.argv[1]) {
    candidates.push(path.dirname(process.argv[1]));
  }

  for (const start of candidates) {
    let cur = path.resolve(start);
    for (let i = 0; i < 16; i++) {
      if (hasRepoMarkers(cur)) return cur;
      const parent = path.dirname(cur);
      if (parent === cur) break;
      cur = parent;
    }
  }

  throw new Error(`Failed to resolve repo root (tried: ${candidates.join(', ')})`);
}

