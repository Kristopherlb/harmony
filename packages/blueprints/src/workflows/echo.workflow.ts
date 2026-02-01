/**
 * packages/blueprints/src/workflows/echo.workflow.ts
 * Minimal workflow that executes one capability by ID (Metric 1).
 * Uses shared executeCapability activity only; no custom activity code for capability execution.
 */
import { BaseBlueprint, SECURITY_CONTEXT_MEMO_KEY } from '@golden/core/workflow';
import { z } from '@golden/schema-registry';

const ECHO_CAP_ID = 'golden.echo';

export interface EchoInput {
  x: number;
}

export interface EchoOutput {
  y: number;
}

export class EchoWorkflow extends BaseBlueprint<EchoInput, EchoOutput, object> {
  readonly metadata = {
    id: 'workflows.echo',
    version: '1.0.0',
    name: 'Echo Workflow',
    description: 'E2e workflow',
    owner: 'platform',
    costCenter: 'CC-0',
    tags: [],
  };
  readonly security = { requiredRoles: [] };
  readonly operations = {
    sla: { targetDuration: '1m', maxDuration: '5m' },
  };
  readonly inputSchema = z.object({ x: z.number() }) as BaseBlueprint<EchoInput, EchoOutput, object>['inputSchema'];
  readonly configSchema = z.object({}) as BaseBlueprint<EchoInput, EchoOutput, object>['configSchema'];

  protected async logic(input: EchoInput, _config: object): Promise<EchoOutput> {
    void _config;
    return this.executeById(ECHO_CAP_ID, input);
  }
}

/** Export for worker: memo key and workflow run. */
export { SECURITY_CONTEXT_MEMO_KEY };

