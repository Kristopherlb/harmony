/**
 * packages/blueprints/src/workflows/system/workbench-draft-run.workflow-run.ts
 * Workflow entrypoint for worker bundle.
 */
import {
  WorkbenchDraftRunWorkflow,
  type WorkbenchDraftRunInput,
  type WorkbenchDraftRunOutput,
} from './workbench-draft-run.workflow';

export async function workbenchDraftRunWorkflow(input: WorkbenchDraftRunInput): Promise<WorkbenchDraftRunOutput> {
  const w = new WorkbenchDraftRunWorkflow();
  return w.main(input, {});
}

