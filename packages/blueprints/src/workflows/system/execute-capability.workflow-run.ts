/**
 * packages/blueprints/src/workflows/system/execute-capability.workflow-run.ts
 * Workflow entrypoint for worker bundle.
 */
import {
  ExecuteCapabilityWorkflow,
  type ExecuteCapabilityInput,
  type ExecuteCapabilityOutput,
} from './execute-capability.workflow';

export async function executeCapabilityWorkflow(input: ExecuteCapabilityInput): Promise<ExecuteCapabilityOutput> {
  const w = new ExecuteCapabilityWorkflow();
  return w.main(input, {});
}

