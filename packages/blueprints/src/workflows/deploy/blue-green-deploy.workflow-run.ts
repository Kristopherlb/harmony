/**
 * packages/blueprints/src/workflows/deploy/blue-green-deploy.workflow-run.ts
 * Temporal workflow entry: run function for BlueGreenDeployWorkflow (required for worker bundle).
 */
import {
  BlueGreenDeployWorkflow,
  type BlueGreenDeployInput,
  type BlueGreenDeployOutput,
  type BlueGreenDeployConfig,
} from './blue-green-deploy.workflow';

export async function blueGreenDeployWorkflow(
  input: BlueGreenDeployInput,
  config: BlueGreenDeployConfig = {}
): Promise<BlueGreenDeployOutput> {
  const w = new BlueGreenDeployWorkflow();
  return w.main(input, config);
}
