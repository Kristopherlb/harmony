/**
 * packages/capabilities/src/reasoners/strategic-planner/graph.ts
 *
 * Purpose: wire Phase 2 deterministic nodes into a LangGraph StateGraph.
 *
 * Notes:
 * - This graph is linear and deterministic; nodes catch errors and accumulate them in state.
 * - The capability wrapper can optionally augment with LLM prompts later, but output shapes
 *   are produced by the same underlying node functions.
 */
import { join } from 'node:path';

import { Annotation, END, START, StateGraph } from '@langchain/langgraph';

import type { StrategicPlannerInput } from './schemas.js';
import type { Gap } from './nodes/analyze-gaps.js';
import { analyzeGaps } from './nodes/analyze-gaps.js';
import type { SuccessMetric } from './nodes/define-metrics.js';
import { defineMetrics } from './nodes/define-metrics.js';
import type { PersonaEvaluation } from './nodes/evaluate-personas.js';
import { evaluatePersonas } from './nodes/evaluate-personas.js';
import type { PreWorkItem } from './nodes/identify-prework.js';
import { identifyPreWork } from './nodes/identify-prework.js';
import type { GeneratorInfo, SkillInfo } from './nodes/inventory-skills.js';
import { inventorySkills } from './nodes/inventory-skills.js';
import type { ParsedPlan } from './nodes/parse-plan.js';
import { parsePlan } from './nodes/parse-plan.js';

export type StrategicPlannerGraphDeps = {
  repoRoot: string;
  projectSkillsDir?: string;
  globalSkillsDir?: string;
  generatorsJsonPath?: string;
};

export const StrategicPlannerGraphState = Annotation.Root({
  input: Annotation<StrategicPlannerInput>,
  repoRoot: Annotation<string>,

  parsedPlan: Annotation<ParsedPlan | null>,
  skills: Annotation<SkillInfo[]>,
  generators: Annotation<GeneratorInfo[]>,

  personaEvaluations: Annotation<PersonaEvaluation[]>,
  gaps: Annotation<Gap[]>,
  preWork: Annotation<PreWorkItem[]>,
  successMetrics: Annotation<SuccessMetric[]>,

  errors: Annotation<string[]>,
});

export type StrategicPlannerGraphStateType = typeof StrategicPlannerGraphState.State;

export function buildStrategicPlannerGraph(deps: StrategicPlannerGraphDeps) {
  const projectSkillsDirDefault = deps.projectSkillsDir ?? join(deps.repoRoot, '.cursor', 'skills');
  const generatorsJsonPathDefault = deps.generatorsJsonPath ?? join(deps.repoRoot, 'tools', 'path', 'generators.json');

  const parsePlanNode = async (state: StrategicPlannerGraphStateType): Promise<Partial<StrategicPlannerGraphStateType>> => {
    try {
      const parsed = await parsePlan(state.input.plan);
      return { parsedPlan: parsed };
    } catch (err) {
      return {
        parsedPlan: null,
        errors: [...state.errors, `parsePlan failed: ${asMessage(err)}`],
      };
    }
  };

  const inventorySkillsNode = async (
    state: StrategicPlannerGraphStateType
  ): Promise<Partial<StrategicPlannerGraphStateType>> => {
    try {
      const projectSkillsDir = state.input.options.skillsPath ?? projectSkillsDirDefault;
      const inv = await inventorySkills({
        projectSkillsDir,
        globalSkillsDir: deps.globalSkillsDir,
        generatorsJsonPath: generatorsJsonPathDefault,
      });
      return { skills: inv.skills, generators: inv.generators };
    } catch (err) {
      return {
        skills: [],
        generators: [],
        errors: [...state.errors, `inventorySkills failed: ${asMessage(err)}`],
      };
    }
  };

  const evaluatePersonasNode = async (
    state: StrategicPlannerGraphStateType
  ): Promise<Partial<StrategicPlannerGraphStateType>> => {
    if (!isEnabled(state, 'personas')) return { personaEvaluations: [] };
    if (!state.parsedPlan) return { personaEvaluations: [], errors: [...state.errors, 'evaluatePersonas skipped: missing parsedPlan'] };

    try {
      const evaluations = await evaluatePersonas({
        plan: state.parsedPlan,
        projectContext: state.input.projectContext,
        skills: state.skills,
      });
      return { personaEvaluations: evaluations };
    } catch (err) {
      return { personaEvaluations: [], errors: [...state.errors, `evaluatePersonas failed: ${asMessage(err)}`] };
    }
  };

  const analyzeGapsNode = async (state: StrategicPlannerGraphStateType): Promise<Partial<StrategicPlannerGraphStateType>> => {
    if (!isEnabled(state, 'gapAnalysis')) return { gaps: [] };
    if (!state.parsedPlan) return { gaps: [], errors: [...state.errors, 'analyzeGaps skipped: missing parsedPlan'] };

    try {
      const gaps = await analyzeGaps({
        plan: state.parsedPlan,
        skills: state.skills,
        generators: state.generators,
      });
      return { gaps };
    } catch (err) {
      return { gaps: [], errors: [...state.errors, `analyzeGaps failed: ${asMessage(err)}`] };
    }
  };

  const identifyPreWorkNode = async (
    state: StrategicPlannerGraphStateType
  ): Promise<Partial<StrategicPlannerGraphStateType>> => {
    if (!isEnabled(state, 'preWorkIdentification')) return { preWork: [] };
    try {
      const preWork = await identifyPreWork({ gaps: state.gaps });
      return { preWork };
    } catch (err) {
      return { preWork: [], errors: [...state.errors, `identifyPreWork failed: ${asMessage(err)}`] };
    }
  };

  const defineMetricsNode = async (
    state: StrategicPlannerGraphStateType
  ): Promise<Partial<StrategicPlannerGraphStateType>> => {
    if (!isEnabled(state, 'metricsDefinition')) return { successMetrics: [] };

    const personas =
      state.personaEvaluations.length > 0
        ? state.personaEvaluations.map((p) => p.persona)
        : defaultPersonas(state.input.projectContext.domainExpert?.role);

    try {
      const successMetrics = await defineMetrics({ personas });
      return { successMetrics };
    } catch (err) {
      return { successMetrics: [], errors: [...state.errors, `defineMetrics failed: ${asMessage(err)}`] };
    }
  };

  return new StateGraph(StrategicPlannerGraphState)
    .addNode('parsePlan', parsePlanNode)
    .addNode('inventorySkills', inventorySkillsNode)
    .addNode('evaluatePersonas', evaluatePersonasNode)
    .addNode('analyzeGaps', analyzeGapsNode)
    .addNode('identifyPreWork', identifyPreWorkNode)
    .addNode('defineMetrics', defineMetricsNode)
    .addEdge(START, 'parsePlan')
    .addEdge('parsePlan', 'inventorySkills')
    .addEdge('inventorySkills', 'evaluatePersonas')
    .addEdge('evaluatePersonas', 'analyzeGaps')
    .addEdge('analyzeGaps', 'identifyPreWork')
    .addEdge('identifyPreWork', 'defineMetrics')
    .addEdge('defineMetrics', END)
    .compile();
}

export async function runStrategicPlannerGraph(
  input: StrategicPlannerInput,
  deps: StrategicPlannerGraphDeps
): Promise<StrategicPlannerGraphStateType> {
  const graph = buildStrategicPlannerGraph(deps);
  return await graph.invoke({
    input,
    repoRoot: deps.repoRoot,
    parsedPlan: null,
    skills: [],
    generators: [],
    personaEvaluations: [],
    gaps: [],
    preWork: [],
    successMetrics: [],
    errors: [],
  });
}

function isEnabled(
  state: StrategicPlannerGraphStateType,
  key: 'personas' | 'gapAnalysis' | 'preWorkIdentification' | 'metricsDefinition'
): boolean {
  const evaluations = state.input.options?.evaluations;
  const v = evaluations ? (evaluations as Record<string, unknown>)[key] : undefined;
  return typeof v === 'boolean' ? v : true;
}

function defaultPersonas(domainExpertRole?: string): string[] {
  return [
    'Agent (AI Assistant)',
    'Developer (Platform Contributor)',
    'End User (Platform Operator)',
    'Platform Engineering Leadership',
    domainExpertRole ? `Domain Expert (${domainExpertRole})` : 'Domain Expert (Project-Specific)',
  ];
}

function asMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

