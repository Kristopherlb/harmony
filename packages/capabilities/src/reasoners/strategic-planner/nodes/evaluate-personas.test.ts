/**
 * packages/capabilities/src/reasoners/strategic-planner/nodes/evaluate-personas.test.ts
 *
 * Purpose: TDD for deterministic persona evaluations (shape-accurate; heuristics only).
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { parsePlan } from './parse-plan.js';
import { evaluatePersonas } from './evaluate-personas.js';

function fixturePath(relativePath: string): string {
  return fileURLToPath(new URL(`../__fixtures__/${relativePath}`, import.meta.url));
}

describe('evaluatePersonas', () => {
  it('returns 5 persona evaluations with bounded scores', async () => {
    const plan = await parsePlan({ type: 'file', path: fixturePath('sample-file.plan.md') });
    const result = await evaluatePersonas({
      plan,
      projectContext: { name: 'demo', domain: 'incident-management' },
      skills: [{ name: 'strategic-planning-protocol', description: '...', skillPath: '/x', source: 'project' }],
    });

    expect(result.length).toBe(5);
    for (const ev of result) {
      expect(typeof ev.persona).toBe('string');
      expect(ev.alignmentScore).toBeGreaterThanOrEqual(1);
      expect(ev.alignmentScore).toBeLessThanOrEqual(10);
      expect(Array.isArray(ev.gaps)).toBe(true);
      expect(Array.isArray(ev.missingSkills)).toBe(true);
    }
  });

  it('includes a domain expert persona when provided', async () => {
    const raw = await readFile(fixturePath('sample-content.json'), 'utf8');
    const plan = await parsePlan({ type: 'content', content: raw });
    const result = await evaluatePersonas({
      plan,
      projectContext: {
        name: 'demo',
        domain: 'incident-management',
        domainExpert: { role: 'On-call incident commander', concerns: ['fast SA'] },
      },
      skills: [],
    });

    expect(result.map((e) => e.persona)).toContain('Domain Expert (On-call incident commander)');
  });
});

