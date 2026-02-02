/**
 * packages/blueprints/src/workflows/incident/incident-post-mortem.workflow-run.ts
 */
import { IncidentPostMortemWorkflow, type IncidentPostMortemInput } from './incident-post-mortem.workflow.js';
import type { IncidentPostMortemOutput } from './incident-post-mortem.logic.js';

export async function incidentPostMortemWorkflow(input: IncidentPostMortemInput): Promise<IncidentPostMortemOutput> {
  const w = new IncidentPostMortemWorkflow();
  return w.main(input, {});
}

