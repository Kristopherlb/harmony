/**
 * packages/tools/mcp-server/src/mcp/temporal-default-runners.ts
 * Temporal-backed runners for MCP tool execution.
 */
import type { CapabilityRunner, BlueprintRunner } from './tool-surface.js';
import type { GoldenCallerContext } from './call-envelope.js';

export type CapabilityBehavior = 'await' | 'start';

export interface MinimalTemporalWorkflowClient {
  workflow: {
    start: (
      workflowType: string,
      options: { taskQueue: string; workflowId: string; args: unknown[]; memo?: Record<string, unknown> }
    ) => Promise<{ workflowId: string; firstExecutionRunId: string; result?: () => Promise<unknown> }>;
  };
}

export interface MinimalBlueprintRegistryEntry {
  blueprintId: string;
  workflowType: string;
}

export function createTemporalDefaultRunners(input: {
  temporal: { client: MinimalTemporalWorkflowClient; taskQueue: string };
  blueprints: Map<string, MinimalBlueprintRegistryEntry>;
  workflowIdFactory: (toolId: string) => string;
  capabilityBehavior: CapabilityBehavior;
  memoFactory: (input: { toolId: string; traceId: string; context?: GoldenCallerContext }) => Record<string, unknown>;
  statusUrlFactory?: (workflowId: string, runId: string) => string;
}): { capabilityRunner: CapabilityRunner; blueprintRunner: BlueprintRunner } {
  const blueprintRunner: BlueprintRunner = async ({ id, args, traceId, context }) => {
    const bp = input.blueprints.get(id);
    if (!bp) throw new Error(`Blueprint not found: ${id}`);
    const handle = await input.temporal.client.workflow.start(bp.workflowType, {
      taskQueue: input.temporal.taskQueue,
      workflowId: input.workflowIdFactory(id),
      args: [args],
      memo: input.memoFactory({ toolId: id, traceId, context }),
    });
    const statusUrl =
      typeof input.statusUrlFactory === 'function'
        ? input.statusUrlFactory(handle.workflowId, handle.firstExecutionRunId)
        : undefined;
    return { result: { workflowId: handle.workflowId, runId: handle.firstExecutionRunId, statusUrl } };
  };

  const capabilityRunner: CapabilityRunner = async ({ id, args, traceId, context }) => {
    const handle = await input.temporal.client.workflow.start('executeCapabilityWorkflow', {
      taskQueue: input.temporal.taskQueue,
      workflowId: input.workflowIdFactory(id),
      args: [{ capId: id, args }],
      memo: input.memoFactory({ toolId: id, traceId, context }),
    });

    if (input.capabilityBehavior === 'await') {
      if (typeof handle.result !== 'function') {
        throw new Error('Temporal handle missing result() in await mode');
      }
      const out = await handle.result();
      const statusUrl =
        typeof input.statusUrlFactory === 'function'
          ? input.statusUrlFactory(handle.workflowId, handle.firstExecutionRunId)
          : undefined;
      return { result: out, meta: { workflowId: handle.workflowId, runId: handle.firstExecutionRunId, statusUrl } as any };
    }

    const statusUrl =
      typeof input.statusUrlFactory === 'function'
        ? input.statusUrlFactory(handle.workflowId, handle.firstExecutionRunId)
        : undefined;
    return { result: { workflowId: handle.workflowId, runId: handle.firstExecutionRunId, statusUrl } };
  };

  return { capabilityRunner, blueprintRunner };
}

