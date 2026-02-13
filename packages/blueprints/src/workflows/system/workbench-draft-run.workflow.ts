/**
 * packages/blueprints/src/workflows/system/workbench-draft-run.workflow.ts
 * Workbench orchestrator: execute a BlueprintDraft (current canvas) as a single workflow run.
 *
 * This workflow is intentionally NOT exposed in the public blueprint registry/tool catalog.
 * The Console server starts it directly to power the Workbench “Run current draft” loop.
 */
import { BaseBlueprint } from '@golden/core/workflow';
import type { BlueprintDraft } from '@golden/core';
import { z } from '@golden/schema-registry';
import { deriveDraftExecutionOrder, isPrimitiveNodeType } from './workbench-draft-run.logic.js';

export interface WorkbenchDraftRunInput {
  draft: BlueprintDraft;
  /** Node IDs that require peer approval before execution (policy computed server-side). */
  criticalNodeIds?: string[];
  approval?: {
    /** Roles required to approve (optional; empty = any approver). */
    requiredRoles?: string[];
    /** Timeout string (e.g. '30m'). Default handled by BaseBlueprint. */
    timeout?: string;
    /** Optional Slack channel to notify (requires worker approval activities configured). */
    notifySlackChannel?: string;
  };
}

export type WorkbenchDraftRunOutput = {
  resultsByNodeId: Record<string, unknown>;
};

export class WorkbenchDraftRunWorkflow extends BaseBlueprint<
  WorkbenchDraftRunInput,
  WorkbenchDraftRunOutput,
  object
> {
  readonly metadata = {
    id: 'workflows.workbench_draft_run',
    version: '1.0.0',
    name: 'Workbench Draft Run',
    description: 'Executes a Workbench draft as a single workflow run (internal).',
    owner: 'platform',
    costCenter: 'CC-0',
    tags: ['system', 'workbench'],
  };

  readonly security = { requiredRoles: [], classification: 'INTERNAL' as const };

  readonly operations = {
    sla: { targetDuration: '5m', maxDuration: '30m' },
  };

  // Local copy of the Workbench IR schema to keep the workflow bundle Node-safe
  // (do not import @golden/core root index into Temporal bundles).
  private readonly draftSchema = z.object({
    title: z.string().min(1),
    summary: z.string(),
    nodes: z.array(
      z.object({
        id: z.string().min(1),
        label: z.string(),
        type: z.string(),
        description: z.string().optional(),
        properties: z.record(z.unknown()).optional(),
      })
    ),
    edges: z.array(
      z.object({
        source: z.string(),
        target: z.string(),
        label: z.string().optional(),
      })
    ),
  });

  readonly inputSchema = z
    .object({
      draft: z.unknown().transform((v, ctx) => {
        const parsed = this.draftSchema.safeParse(v);
        if (!parsed.success) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid BlueprintDraft input' });
          return z.NEVER;
        }
        return parsed.data;
      }),
    })
    .describe('WorkbenchDraftRun input') as BaseBlueprint<
    WorkbenchDraftRunInput,
    WorkbenchDraftRunOutput,
    object
  >['inputSchema'];

  readonly configSchema = z.object({}) as BaseBlueprint<
    WorkbenchDraftRunInput,
    WorkbenchDraftRunOutput,
    object
  >['configSchema'];

  protected async logic(input: WorkbenchDraftRunInput): Promise<WorkbenchDraftRunOutput> {
    const ordered = deriveDraftExecutionOrder(input.draft);
    const resultsByNodeId: Record<string, unknown> = {};
    const critical = new Set(Array.isArray(input.criticalNodeIds) ? input.criticalNodeIds : []);
    let approvedForCritical = false;

    for (const node of ordered) {
      if (isPrimitiveNodeType(node.type)) continue;

      if (!approvedForCritical && critical.has(node.id)) {
        const criticalToolIds = ordered
          .filter((n) => critical.has(n.id))
          .map((n) => n.type)
          .filter(Boolean);
        const uniqueTools = Array.from(new Set(criticalToolIds)).sort();
        const reason = `Approve executing CRITICAL steps for draft: ${input.draft.title}. Tools: ${uniqueTools.join(
          ", "
        )}`;
        await this.waitForApproval({
          reason,
          requiredRoles: input.approval?.requiredRoles ?? [],
          timeout: input.approval?.timeout,
          notifySlackChannel: input.approval?.notifySlackChannel,
        });
        approvedForCritical = true;
      }

      const nodeInput =
        node.properties && typeof node.properties === 'object' && !Array.isArray(node.properties)
          ? node.properties
          : {};

      const out = await this.executeById(node.type, nodeInput, {
        correlation: { nodeId: node.id },
      });
      resultsByNodeId[node.id] = out;
    }

    return { resultsByNodeId };
  }
}

