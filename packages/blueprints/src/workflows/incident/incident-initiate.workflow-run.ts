/**
 * packages/blueprints/src/workflows/incident/incident-initiate.workflow-run.ts
 */
import { IncidentInitiateWorkflow, type IncidentInitiateInput } from './incident-initiate.workflow.js';
import type { IncidentInitiateOutput } from './incident-initiate.logic.js';

export async function incidentInitiateWorkflow(input: IncidentInitiateInput): Promise<IncidentInitiateOutput> {
  const w = new IncidentInitiateWorkflow();
  return w.main(input, {});
}

