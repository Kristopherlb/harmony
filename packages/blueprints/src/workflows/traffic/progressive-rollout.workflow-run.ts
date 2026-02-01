/**
 * packages/blueprints/src/workflows/traffic/progressive-rollout.workflow-run.ts
 * Temporal workflow entry: run function for ProgressiveRolloutWorkflow (required for worker bundle).
 */
import {
  ProgressiveRolloutWorkflow,
  type ProgressiveRolloutInput,
  type ProgressiveRolloutOutput,
  type ProgressiveRolloutConfig,
} from './progressive-rollout.workflow';

export async function progressiveRolloutWorkflow(
  input: ProgressiveRolloutInput,
  config: ProgressiveRolloutConfig = {}
): Promise<ProgressiveRolloutOutput> {
  const w = new ProgressiveRolloutWorkflow();
  return w.main(input, config);
}
