/**
 * packages/blueprints/src/workflows/math-pipeline.workflow-run.ts
 * Workflow entrypoint for worker bundle.
 */
import { MathPipelineWorkflow, type MathPipelineInput, type MathPipelineOutput } from './math-pipeline.workflow';

export async function mathPipelineWorkflow(input: MathPipelineInput): Promise<MathPipelineOutput> {
  const w = new MathPipelineWorkflow();
  return w.main(input, {});
}

