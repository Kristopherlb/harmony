/**
 * packages/capabilities/src/reasoners/strategic-planner/nodes/parse-plan.test.ts
 *
 * Purpose: TDD for parsing plan sources (file/content/intent) into a deterministic ParsedPlan.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { parsePlan } from './parse-plan.js';

function fixturePath(relativePath: string): string {
  return fileURLToPath(new URL(`../__fixtures__/${relativePath}`, import.meta.url));
}

describe('parsePlan', () => {
  it('parses file (.plan.md) into a normalized plan with title and goals', async () => {
    const parsed = await parsePlan({ type: 'file', path: fixturePath('sample-file.plan.md') });
    expect(parsed.source.type).toBe('file');
    expect(parsed.format).toBe('markdown');
    expect(parsed.title).toContain('Incident On-Call Handoff Improvements');
    expect(parsed.goals.length).toBeGreaterThan(0);
    expect(parsed.constraints.length).toBeGreaterThan(0);
  });

  it('parses JSON content into a normalized plan with phases', async () => {
    const raw = await readFile(fixturePath('sample-content.json'), 'utf8');
    const parsed = await parsePlan({ type: 'content', content: raw });
    expect(parsed.source.type).toBe('content');
    expect(parsed.format).toBe('json');
    expect(parsed.phases.length).toBeGreaterThan(0);
  });

  it('converts intent into a normalized plan with description and goals', async () => {
    const parsed = await parsePlan({
      type: 'intent',
      description: 'Implement a strategic planner reasoner',
      goals: ['OCS compliance', 'TDD'],
      constraints: ['deterministic output'],
    });
    expect(parsed.source.type).toBe('intent');
    expect(parsed.format).toBe('intent');
    expect(parsed.intent).toContain('strategic planner');
    expect(parsed.goals).toEqual(['OCS compliance', 'TDD']);
  });
});

