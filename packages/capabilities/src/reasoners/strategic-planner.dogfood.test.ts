/**
 * packages/capabilities/src/reasoners/strategic-planner.dogfood.test.ts
 *
 * Purpose: dogfood test — run strategic-planner on its own implementation plan.
 */
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

import { describe, expect, it } from 'vitest';

import { strategicPlannerCapability } from './strategic-planner.capability.js';
import { evaluateStrategicPlanner } from './strategic-planner/evaluate.js';

function repoRoot(): string {
  // reasoners/ -> src/ -> capabilities/ -> packages/ -> repo root
  return fileURLToPath(new URL('../../../..', import.meta.url));
}

function plannerPlanPath(): string {
  // Planner plan is stored in Cursor's global plans directory, not in-repo.
  return join(homedir(), '.cursor', 'plans', 'strategic_planner_capability_7df7ed32.plan.md');
}

describe('strategic-planner dogfood', () => {
  it('evaluates its own plan and produces schema-valid output', async () => {
    const output = await evaluateStrategicPlanner(
      {
        plan: { type: 'file', path: plannerPlanPath() },
        projectContext: { name: 'harmony', domain: 'other' },
        options: {
          depth: 'standard',
          outputFormat: 'json',
          createCheckpoint: false,
          evaluations: {
            personas: true,
            gapAnalysis: true,
            preWorkIdentification: true,
            metricsDefinition: true,
          },
        },
      },
      { repoRoot: repoRoot(), globalSkillsDir: `${repoRoot()}/__does_not_exist__` }
    );

    const parsed = strategicPlannerCapability.schemas.output.parse(output);
    expect(parsed.personaEvaluations.length).toBe(5);
    expect(parsed.summary.projectName).toBe('harmony');
    expect(parsed.successMetrics.length).toBeGreaterThan(0);
  });
});

