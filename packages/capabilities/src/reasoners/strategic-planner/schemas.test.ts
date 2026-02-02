/**
 * packages/capabilities/src/reasoners/strategic-planner/schemas.test.ts
 * Schema contract tests for the Strategic Planner Reasoner.
 *
 * Purpose: lock input/output shape early (TDD) before implementing the capability.
 */
import { describe, expect, it } from 'vitest';

import { strategicPlannerInputSchema, strategicPlannerOutputSchema } from './schemas.js';

describe('strategic-planner schemas', () => {
  it('accepts file plan source and applies option defaults', () => {
    const parsed = strategicPlannerInputSchema.parse({
      plan: { type: 'file', path: './plans/sample.plan.md' },
      projectContext: { name: 'demo', domain: 'incident-management' },
    });

    expect(parsed.plan.type).toBe('file');
    expect(parsed.projectContext.domain).toBe('incident-management');
    expect(parsed.options.depth).toBe('standard');
    expect(parsed.options.outputFormat).toBe('both');
    expect(parsed.options.createCheckpoint).toBe(true);
    expect(parsed.options.evaluations.personas).toBe(true);
    expect(parsed.options.evaluations.gapAnalysis).toBe(true);
    expect(parsed.options.evaluations.preWorkIdentification).toBe(true);
    expect(parsed.options.evaluations.metricsDefinition).toBe(true);
  });

  it('accepts content plan source', () => {
    const parsed = strategicPlannerInputSchema.parse({
      plan: { type: 'content', content: '# My Plan\n\n## Phase 1\nDo stuff\n' },
      projectContext: { name: 'demo', domain: 'developer-experience' },
      options: { depth: 'quick' },
    });

    expect(parsed.plan.type).toBe('content');
    expect(parsed.options.depth).toBe('quick');
  });

  it('accepts intent plan source', () => {
    const parsed = strategicPlannerInputSchema.parse({
      plan: {
        type: 'intent',
        description: 'Implement a new reasoner capability for strategic planning',
        goals: ['OCS compliance', 'TDD coverage'],
        constraints: ['deterministic structure'],
      },
      projectContext: { name: 'demo', domain: 'compliance' },
    });

    expect(parsed.plan.type).toBe('intent');
    expect(parsed.plan.goals).toEqual(['OCS compliance', 'TDD coverage']);
  });

  it('rejects invalid persona alignmentScore', () => {
    const result = strategicPlannerOutputSchema.safeParse({
      summary: {
        projectName: 'demo',
        overallReadiness: 'ready',
        averageAlignmentScore: 7,
        totalGaps: 0,
        criticalGaps: 0,
        preWorkItems: 0,
      },
      personaEvaluations: [
        {
          persona: 'Agent',
          alignmentScore: 11,
          gaps: [],
          missingSkills: [],
        },
      ],
      gaps: [],
      skillsMatrix: {
        prioritySkills: [],
        referenceSkills: [],
        missingSkills: [],
      },
      preWork: [],
      successMetrics: [],
    });

    expect(result.success).toBe(false);
  });
});

