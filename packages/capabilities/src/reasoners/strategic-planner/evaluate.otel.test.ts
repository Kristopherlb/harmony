/**
 * packages/capabilities/src/reasoners/strategic-planner/evaluate.otel.test.ts
 *
 * Purpose: ensure in-process evaluation emits per-stage spans when ctx is provided.
 */
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

// Mock @golden/core to capture span calls (and still execute the wrapped function).
vi.mock('@golden/core', async (importOriginal) => {
  const mod = (await importOriginal()) as Record<string, unknown>;
  return {
    ...mod,
    withGoldenSpan: vi.fn(async (_name: string, _ctx: unknown, _componentType: unknown, fn: (span: unknown) => Promise<unknown>) => {
      return await fn({});
    }),
  };
});

import { withGoldenSpan } from '@golden/core';
import { evaluateStrategicPlanner } from './evaluate.js';

function repoRoot(): string {
  // strategic-planner/ -> reasoners/ -> src/ -> capabilities/ -> packages/ -> repo root
  return fileURLToPath(new URL('../../../../..', import.meta.url));
}

describe('evaluateStrategicPlanner (otel)', () => {
  it('wraps stages in withGoldenSpan when ctx is provided', async () => {
    await evaluateStrategicPlanner(
      {
        plan: { type: 'intent', description: 'Plan something', goals: ['a', 'b', 'c'], constraints: ['x', 'y'] },
        projectContext: { name: 'harmony', domain: 'other' },
        options: {
          depth: 'quick',
          outputFormat: 'json',
          createCheckpoint: false,
          evaluations: { personas: true, gapAnalysis: true, preWorkIdentification: true, metricsDefinition: true },
        },
      },
      {
        repoRoot: repoRoot(),
        globalSkillsDir: `${repoRoot()}/__does_not_exist__`,
        // Minimal valid GoldenContext (shape validated elsewhere; tests use a stub).
        ctx: { app_id: 'harmony', environment: 'test', initiator_id: 'vitest', trace_id: 'trace-1' },
      } as unknown as { repoRoot: string }
    );

    expect(vi.isMockFunction(withGoldenSpan)).toBe(true);
    expect((withGoldenSpan as unknown as { mock: { calls: unknown[][] } }).mock.calls.length).toBeGreaterThan(0);
  });
});

