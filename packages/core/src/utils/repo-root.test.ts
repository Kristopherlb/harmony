/**
 * packages/core/src/utils/repo-root.test.ts
 * TDD: repo-root resolution is stable across runners.
 */
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { getRepoRoot } from './repo-root.js';

describe('getRepoRoot', () => {
  it('resolves a repo root that contains monorepo markers', () => {
    const root = getRepoRoot();
    expect(path.isAbsolute(root)).toBe(true);
    expect(existsSync(path.join(root, 'nx.json'))).toBe(true);
    expect(existsSync(path.join(root, 'pnpm-workspace.yaml'))).toBe(true);
  });

  it('resolves a repo root that contains the policies directory', () => {
    const root = getRepoRoot();
    expect(existsSync(path.join(root, 'policies'))).toBe(true);
    expect(existsSync(path.join(root, 'policies', 'cdm-001-domain-allowlist.json'))).toBe(true);
  });
});

