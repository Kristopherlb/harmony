/**
 * packages/blueprints/src/workflows/system/execute-capability.workflow.ts
 * System orchestrator: execute a single capability by ID via BaseBlueprint.executeById().
 */
import { BaseBlueprint } from '@golden/core/workflow';
import { z } from '@golden/schema-registry';

export interface ExecuteCapabilityInput {
  capId: string;
  args: unknown;
  config?: unknown;
  secretRefs?: unknown;
}

export type ExecuteCapabilityOutput = unknown;

export class ExecuteCapabilityWorkflow extends BaseBlueprint<ExecuteCapabilityInput, ExecuteCapabilityOutput, object> {
  readonly metadata = {
    id: 'workflows.execute_capability',
    version: '1.0.0',
    name: 'Execute Capability',
    description: 'Executes an OCS capability by ID via the shared platform activity.',
    owner: 'platform',
    costCenter: 'CC-0',
    tags: ['system'],
  };

  readonly security = { requiredRoles: [], classification: 'INTERNAL' as const };

  readonly operations = {
    sla: { targetDuration: '1m', maxDuration: '5m' },
  };

  readonly inputSchema = z
    .object({
      capId: z.string(),
      args: z.unknown(),
      config: z.unknown().optional(),
      secretRefs: z.unknown().optional(),
    })
    .describe('ExecuteCapability input') as BaseBlueprint<ExecuteCapabilityInput, ExecuteCapabilityOutput, object>['inputSchema'];

  readonly configSchema = z.object({}) as BaseBlueprint<
    ExecuteCapabilityInput,
    ExecuteCapabilityOutput,
    object
  >['configSchema'];

  protected async logic(input: ExecuteCapabilityInput, _config: object): Promise<ExecuteCapabilityOutput> {
    void _config;
    return this.executeById(input.capId, input.args, { config: input.config, secretRefs: input.secretRefs });
  }
}

