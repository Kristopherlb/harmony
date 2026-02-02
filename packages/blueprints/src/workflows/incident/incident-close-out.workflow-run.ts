/**
 * packages/blueprints/src/workflows/incident/incident-close-out.workflow-run.ts
 */
import { IncidentCloseOutWorkflow, type IncidentCloseOutInput } from './incident-close-out.workflow.js';
import type { IncidentCloseOutOutput } from './incident-close-out.logic.js';

export async function incidentCloseOutWorkflow(input: IncidentCloseOutInput): Promise<IncidentCloseOutOutput> {
  const w = new IncidentCloseOutWorkflow();
  return w.main(input, {});
}

