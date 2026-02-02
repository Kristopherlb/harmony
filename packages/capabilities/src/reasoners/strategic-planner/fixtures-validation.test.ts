/**
 * packages/capabilities/src/reasoners/strategic-planner/fixtures-validation.test.ts
 *
 * Purpose: ensure committed fixtures remain parseable and minimally well-formed.
 * This keeps tests deterministic and prevents “fixture drift” from breaking later nodes.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

function fixturePath(relativePath: string): string {
  return fileURLToPath(new URL(`./__fixtures__/${relativePath}`, import.meta.url));
}

describe('strategic-planner fixtures', () => {
  it('sample-content.json parses as JSON and includes expected top-level keys', async () => {
    const raw = await readFile(fixturePath('sample-content.json'), 'utf8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    expect(typeof parsed.title).toBe('string');
    expect(typeof parsed.owner).toBe('string');
    expect(typeof parsed.domain).toBe('string');
    expect(typeof parsed.intent).toBe('string');
    expect(Array.isArray(parsed.goals)).toBe(true);
    expect(Array.isArray(parsed.phases)).toBe(true);
  });

  it('sample-intent.json parses as JSON and includes expected top-level keys', async () => {
    const raw = await readFile(fixturePath('sample-intent.json'), 'utf8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    expect(parsed.plan).toBeTruthy();
    expect(parsed.projectContext).toBeTruthy();
    expect(parsed.options).toBeTruthy();

    const plan = parsed.plan as Record<string, unknown>;
    expect(plan.type).toBe('intent');
    expect(typeof plan.description).toBe('string');
    expect(Array.isArray(plan.goals)).toBe(true);
  });

  it('sample-file.plan.md is non-empty and includes minimal expected headings', async () => {
    const raw = await readFile(fixturePath('sample-file.plan.md'), 'utf8');
    expect(raw.trim().length).toBeGreaterThan(0);

    // Frontmatter sanity
    expect(raw.startsWith('---')).toBe(true);
    expect(raw).toContain('title:');

    // Minimal headings sanity (avoid heavy parsing here)
    expect(raw).toContain('## Intent');
    expect(raw).toContain('## Goals');
    expect(raw).toContain('## Constraints');
    expect(raw).toContain('## Deliverables');
    expect(raw).toContain('## Phases');
  });
});

