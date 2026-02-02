/**
 * packages/tools/harmony-cli/src/strategic-plan.render.test.ts
 *
 * Purpose: TDD coverage for rendering Strategic Planner output to markdown.
 */
import { describe, expect, it } from 'vitest';

// NOTE: This will fail until implemented (TDD: RED first).
import { renderStrategicPlannerMarkdown } from './strategic-plan.render.js';

describe('renderStrategicPlannerMarkdown', () => {
  it('renders key headings and summary fields', () => {
    const md = renderStrategicPlannerMarkdown({
      summary: {
        projectName: 'harmony',
        overallReadiness: 'needs-prework',
        averageAlignmentScore: 6.4,
        totalGaps: 8,
        criticalGaps: 4,
        preWorkItems: 4,
      },
      personaEvaluations: [],
      gaps: [],
      skillsMatrix: { prioritySkills: [], referenceSkills: [], missingSkills: [] },
      preWork: [],
      successMetrics: [],
      updatedTodos: [],
      checkpoint: { path: '', created: false },
    });

    expect(md).toContain('# Strategic Planner Evaluation');
    expect(md).toContain('## Summary');
    expect(md).toContain('**Project:** harmony');
    expect(md).toContain('**Overall readiness:** needs-prework');
  });
});

