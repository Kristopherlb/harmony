/**
 * packages/capabilities/src/reasoners/strategic-planner/types.ts
 * Strategic Planner internal types.
 *
 * Purpose: provide ergonomic, strongly-typed aliases over schema-derived types.
 */
import type { StrategicPlannerInput, StrategicPlannerOutput } from './schemas';

export type StrategicPlannerPlanSource = StrategicPlannerInput['plan'];
export type StrategicPlannerProjectContext = StrategicPlannerInput['projectContext'];
export type StrategicPlannerOptions = StrategicPlannerInput['options'];

export type StrategicPlannerSummary = StrategicPlannerOutput['summary'];
export type StrategicPlannerPersonaEvaluation = StrategicPlannerOutput['personaEvaluations'][number];
export type StrategicPlannerGap = StrategicPlannerOutput['gaps'][number];
export type StrategicPlannerPreWorkItem = StrategicPlannerOutput['preWork'][number];
export type StrategicPlannerSuccessMetric = StrategicPlannerOutput['successMetrics'][number];

