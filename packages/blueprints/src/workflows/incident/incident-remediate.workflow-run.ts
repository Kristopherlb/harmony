/**
 * packages/blueprints/src/workflows/incident/incident-remediate.workflow-run.ts
 */
import { IncidentRemediateWorkflow, type IncidentRemediateInput } from './incident-remediate.workflow.js';
import type { IncidentRemediateOutput } from './incident-remediate.logic.js';

export async function incidentRemediateWorkflow(input: IncidentRemediateInput): Promise<IncidentRemediateOutput> {
  const w = new IncidentRemediateWorkflow();
  return w.main(input, {});
}

