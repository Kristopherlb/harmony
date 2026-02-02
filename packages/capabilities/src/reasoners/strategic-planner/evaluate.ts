/**
 * packages/capabilities/src/reasoners/strategic-planner/evaluate.ts
 *
 * Purpose: in-process evaluator that composes the LangGraph graph and compiles a schema-valid output.
 *
 * This is used for TCS-001 tests and dogfooding. The OCS capability runtime path (Dagger container)
 * may execute a separate script, but should remain behaviorally aligned with this evaluator.
 */
import type { GoldenContext } from '@golden/core';
import { withGoldenSpan } from '@golden/core';

import type { StrategicPlannerInput, StrategicPlannerOutput } from './schemas.js';
import { runStrategicPlannerGraph } from './graph.js';
import { analyzeGaps } from './nodes/analyze-gaps.js';
import { defineMetrics } from './nodes/define-metrics.js';
import { evaluatePersonas } from './nodes/evaluate-personas.js';
import { identifyPreWork } from './nodes/identify-prework.js';
import { inventorySkills } from './nodes/inventory-skills.js';
import { parsePlan } from './nodes/parse-plan.js';

export type EvaluateStrategicPlannerDeps = {
  repoRoot: string;
  globalSkillsDir?: string;
  ctx?: GoldenContext;
};

export async function evaluateStrategicPlanner(
  input: StrategicPlannerInput,
  deps: EvaluateStrategicPlannerDeps
): Promise<StrategicPlannerOutput> {
  const state =
    deps.ctx == null
      ? await runStrategicPlannerGraph(input, { repoRoot: deps.repoRoot, globalSkillsDir: deps.globalSkillsDir })
      : await evaluateWithSpans(input, deps);

  const skillsMatrix = {
    prioritySkills: [
      { skill: 'test-driven-development', reason: 'Enforces red-green-refactor and prevents drift', readBefore: 'Phase 1' },
      { skill: 'open-capability-standard', reason: 'OCS compliance for schemas/security/aiHints', readBefore: 'Phase 1' },
      { skill: 'agent-specification-standard', reason: 'ASS-001 Reasoner patterns and safety guardrails', readBefore: 'Phase 1' },
      { skill: 'pattern-catalog-capabilities', reason: 'Reasoner baseline expectations (CPC-001)', readBefore: 'Phase 1' },
      { skill: 'testing-certification-standard', reason: 'TCS-001 contract verification requirements', readBefore: 'Phase 4.1' },
    ],
    referenceSkills: [
      { skill: 'strategic-planning-protocol', phases: ['Phase 2', 'Phase 3'] },
      { skill: 'langgraph-reasoner-patterns', phases: ['Phase 2', 'Phase 3'] },
      { skill: 'prompt-engineering', phases: ['Phase 3.1'] },
      { skill: 'golden-observability', phases: ['Backlog'] },
    ],
    missingSkills: [],
  } satisfies StrategicPlannerOutput['skillsMatrix'];

  const personaEvaluations = state.personaEvaluations;
  const gaps = state.gaps;
  const preWork = state.preWork;
  const successMetrics = state.successMetrics;

  const averageAlignmentScore =
    personaEvaluations.length > 0
      ? Math.round((personaEvaluations.reduce((acc, p) => acc + p.alignmentScore, 0) / personaEvaluations.length) * 10) / 10
      : 0;

  const criticalGaps = gaps.filter((g) => g.priority === 'P0' || g.priority === 'P1').length;
  const overallReadiness = criticalGaps > 0 || preWork.length > 0 ? 'needs-prework' : 'ready';

  return {
    summary: {
      projectName: input.projectContext.name,
      overallReadiness,
      averageAlignmentScore,
      totalGaps: gaps.length,
      criticalGaps,
      preWorkItems: preWork.length,
    },
    personaEvaluations,
    gaps,
    skillsMatrix,
    preWork,
    successMetrics,
    updatedTodos: [],
    checkpoint: { path: '', created: false },
  };
}

async function evaluateWithSpans(
  input: StrategicPlannerInput,
  deps: EvaluateStrategicPlannerDeps
): Promise<{
  personaEvaluations: StrategicPlannerOutput['personaEvaluations'];
  gaps: StrategicPlannerOutput['gaps'];
  preWork: StrategicPlannerOutput['preWork'];
  successMetrics: StrategicPlannerOutput['successMetrics'];
}> {
  const ctx = deps.ctx!;

  const parsedPlan = await withGoldenSpan('strategic-planner.parsePlan', ctx, 'REASONER', async () => {
    return await parsePlan(input.plan);
  });

  const { skills, generators } = await withGoldenSpan('strategic-planner.inventorySkills', ctx, 'REASONER', async () => {
    const projectSkillsDir = input.options.skillsPath ?? `${deps.repoRoot}/.cursor/skills`;
    return await inventorySkills({
      projectSkillsDir,
      globalSkillsDir: deps.globalSkillsDir,
      generatorsJsonPath: `${deps.repoRoot}/tools/path/generators.json`,
    });
  });

  const personasEnabled = isEnabled(input, 'personas');
  const gapsEnabled = isEnabled(input, 'gapAnalysis');
  const preWorkEnabled = isEnabled(input, 'preWorkIdentification');
  const metricsEnabled = isEnabled(input, 'metricsDefinition');

  const personaEvaluations = personasEnabled
    ? await withGoldenSpan('strategic-planner.evaluatePersonas', ctx, 'REASONER', async () => {
        return await evaluatePersonas({ plan: parsedPlan, projectContext: input.projectContext, skills });
      })
    : [];

  const gaps = gapsEnabled
    ? await withGoldenSpan('strategic-planner.analyzeGaps', ctx, 'REASONER', async () => {
        return await analyzeGaps({ plan: parsedPlan, skills, generators });
      })
    : [];

  const preWork = preWorkEnabled
    ? await withGoldenSpan('strategic-planner.identifyPreWork', ctx, 'REASONER', async () => {
        return await identifyPreWork({ gaps });
      })
    : [];

  const personaLabels =
    personaEvaluations.length > 0
      ? personaEvaluations.map((p) => p.persona)
      : [
          'Agent (AI Assistant)',
          'Developer (Platform Contributor)',
          'End User (Platform Operator)',
          'Platform Engineering Leadership',
          input.projectContext.domainExpert?.role
            ? `Domain Expert (${input.projectContext.domainExpert.role})`
            : 'Domain Expert (Project-Specific)',
        ];

  const successMetrics = metricsEnabled
    ? await withGoldenSpan('strategic-planner.defineMetrics', ctx, 'REASONER', async () => {
        return await defineMetrics({ personas: personaLabels });
      })
    : [];

  return { personaEvaluations, gaps, preWork, successMetrics };
}

function isEnabled(
  input: StrategicPlannerInput,
  key: 'personas' | 'gapAnalysis' | 'preWorkIdentification' | 'metricsDefinition'
): boolean {
  const evaluations = input.options?.evaluations;
  const v = evaluations ? (evaluations as Record<string, unknown>)[key] : undefined;
  return typeof v === 'boolean' ? v : true;
}

