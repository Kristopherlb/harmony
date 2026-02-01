/**
 * packages/blueprints/src/workflows/echo.workflow-run.ts
 * Temporal workflow entry: run function for EchoWorkflow (required for worker bundle).
 */
import { EchoWorkflow, type EchoInput, type EchoOutput } from './echo.workflow';

export async function echoWorkflow(input: EchoInput): Promise<EchoOutput> {
  const w = new EchoWorkflow();
  return w.main(input, {});
}

