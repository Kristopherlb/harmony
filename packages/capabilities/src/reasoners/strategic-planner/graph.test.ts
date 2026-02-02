/**
 * packages/capabilities/src/reasoners/strategic-planner/graph.test.ts
 *
 * Purpose: TDD smoke test for LangGraph wiring (node composition + state flow).
 */
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import type { StrategicPlannerInput } from './schemas.js';
import { runStrategicPlannerGraph } from './graph.js';

function repoRoot(): string {
  // strategic-planner/ -> reasoners/ -> src/ -> capabilities/ -> packages/ -> repo root
  return fileURLToPath(new URL('../../../../..', import.meta.url));
}

function fixturePath(relativePath: string): string {
  return fileURLToPath(new URL(`./__fixtures__/${relativePath}`, import.meta.url));
}

describe('StrategicPlanner graph', () => {
  it('runs end-to-end and produces all primary outputs', async () => {
    const input: StrategicPlannerInput = {
      plan: { type: 'file', path: fixturePath('sample-file.plan.md') },
      projectContext: { name: 'harmony', domain: 'incident-management' },
      options: {
        depth: 'quick',
        outputFormat: 'json',
        createCheckpoint: false,
        evaluations: {
          personas: true,
          gapAnalysis: true,
          preWorkIdentification: true,
          metricsDefinition: true,
        },
      },
    };

    const state = await runStrategicPlannerGraph(input, { repoRoot: repoRoot() });

    expect(state.parsedPlan.title).toContain('Incident On-Call Handoff');
    expect(state.skills.length).toBeGreaterThan(10);
    expect(state.personaEvaluations.length).toBe(5);
    expect(state.gaps.length).toBeGreaterThan(0);
    expect(state.preWork.length).toBeGreaterThan(0);
    expect(state.successMetrics.length).toBeGreaterThan(0);
    expect(state.errors).toEqual([]);
  });
});

