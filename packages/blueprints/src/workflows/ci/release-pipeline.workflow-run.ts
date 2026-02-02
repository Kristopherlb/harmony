/**
 * packages/blueprints/src/workflows/ci/release-pipeline.workflow-run.ts
 * Temporal workflow entry: run function for ReleasePipelineWorkflow (required for worker bundle).
 */
import {
  ReleasePipelineWorkflow,
  type ReleasePipelineInput,
  type ReleasePipelineOutput,
  type ReleasePipelineConfig,
} from './release-pipeline.workflow';

export async function releasePipelineWorkflow(
  input: ReleasePipelineInput,
  config: ReleasePipelineConfig = {}
): Promise<ReleasePipelineOutput> {
  const w = new ReleasePipelineWorkflow();
  return w.main(input, config);
}
