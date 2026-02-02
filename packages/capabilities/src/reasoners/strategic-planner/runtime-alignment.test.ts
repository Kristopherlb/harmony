/**
 * packages/capabilities/src/reasoners/strategic-planner/runtime-alignment.test.ts
 *
 * Purpose: prevent drift between the in-process evaluator and the runtime (container) evaluator.
 *
 * We compare a stable subset of outputs to avoid brittle coupling while still catching regressions.
 */
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { evaluateStrategicPlanner } from './evaluate.js';
import type { StrategicPlannerInput } from './schemas.js';

// ESM import of the runtime module (checked-in asset).
import { runtimeEvaluate } from './runtime/strategic-planner.runtime.mjs';

function repoRoot(): string {
  // strategic-planner/ -> reasoners/ -> src/ -> capabilities/ -> packages/ -> repo root
  return fileURLToPath(new URL('../../../../..', import.meta.url));
}

function fixturePath(relativePath: string): string {
  return fileURLToPath(new URL(`./__fixtures__/${relativePath}`, import.meta.url));
}

function stableProjection(output: {
  summary: unknown;
  personaEvaluations: Array<{ persona: string }>;
  gaps: Array<{ category: string; priority: string; item: string }>;
  preWork: Array<{ id: string; priority: string }>;
  successMetrics: Array<{ persona: string; metric: string }>;
}) {
  return {
    summary: output.summary,
    personas: output.personaEvaluations.map((p) => p.persona),
    gaps: output.gaps.map((g) => ({ category: g.category, priority: g.priority, item: g.item })),
    preWork: output.preWork.map((p) => ({ id: p.id, priority: p.priority })),
    successMetrics: output.successMetrics.map((m) => ({ persona: m.persona, metric: m.metric })),
  };
}

describe('strategic-planner evaluator alignment', () => {
  it('in-process and runtime evaluators match on stable projections for file fixture', async () => {
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

    const inProcess = await evaluateStrategicPlanner(input, { repoRoot: repoRoot(), globalSkillsDir: `${repoRoot()}/__does_not_exist__` });
    const runtime = runtimeEvaluate(input, repoRoot());

    expect(stableProjection(runtime)).toEqual(stableProjection(inProcess));
  });
});

