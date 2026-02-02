/**
 * packages/capabilities/src/reasoners/strategic-planner/nodes/analyze-gaps.test.ts
 *
 * Purpose: TDD for 8-category gap analysis scaffolding.
 */
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { parsePlan } from './parse-plan.js';
import { analyzeGaps } from './analyze-gaps.js';

function fixturePath(relativePath: string): string {
  return fileURLToPath(new URL(`../__fixtures__/${relativePath}`, import.meta.url));
}

describe('analyzeGaps', () => {
  it('emits only allowed categories and priorities', async () => {
    const plan = await parsePlan({ type: 'file', path: fixturePath('sample-file.plan.md') });
    const gaps = await analyzeGaps({
      plan,
      skills: [],
      generators: [],
    });

    expect(Array.isArray(gaps)).toBe(true);
    for (const g of gaps) {
      expect(
        [
          'standards',
          'skills',
          'generators',
          'adrs',
          'documentation',
          'mcp-tools',
          'testing',
          'configuration',
        ].includes(g.category)
      ).toBe(true);
      expect(['P0', 'P1', 'P2', 'P3'].includes(g.priority)).toBe(true);
      expect(['low', 'medium', 'high'].includes(g.effort)).toBe(true);
      expect(typeof g.item).toBe('string');
      expect(typeof g.description).toBe('string');
    }
  });

  it('includes a testing gap when plan content does not mention tests', async () => {
    const plan = await parsePlan({
      type: 'content',
      content: `# Plan\n\n## Intent\nDo something.\n\n## Goals\n- Ship it\n`,
    });
    const gaps = await analyzeGaps({ plan, skills: [], generators: [] });
    expect(gaps.some((g) => g.category === 'testing')).toBe(true);
  });
});

