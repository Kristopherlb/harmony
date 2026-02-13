/**
 * packages/apps/console/client/src/features/workbench/live-canvas-state.ts
 * Phase 4.3.2: Types and helpers for canvas live execution state.
 * Maps workflow status to per-node execution status for visualization.
 */

/** Execution status for a single node on the canvas (pending/running/completed/failed). */
export type NodeExecutionStatus = "pending" | "running" | "completed" | "failed";

/** Workflow-level describe shape used to derive node status. */
export type WorkflowDescribeStatus = {
  status: string;
  startTime?: string;
  closeTime?: string;
};

/** Step-level progress emitted by GET /api/workflows/:id/progress (Phase 4.3.2 / IMP-045). */
export type WorkflowStepProgress = {
  seq: number;
  activityId: string;
  capId: string;
  /** Workbench node id correlation (preferred when available). */
  nodeId?: string;
  status: NodeExecutionStatus;
};

/**
 * Derives per-node execution status from workflow-level status.
 * MVP: all nodes share the same state (running / completed / failed).
 * Future: can be replaced with step-level status from workflow history.
 */
export function deriveNodeExecutionStatus(
  workflowStatus: WorkflowDescribeStatus | null,
  nodeIds: string[]
): Record<string, NodeExecutionStatus> | undefined {
  if (!workflowStatus) return undefined;

  const status = workflowStatus.status;
  const nodeStatus: NodeExecutionStatus =
    status === "RUNNING" || status === "CONTINUED_AS_NEW"
      ? "running"
      : status === "COMPLETED"
        ? "completed"
        : status === "FAILED" || status === "CANCELED" || status === "TERMINATED"
          ? "failed"
          : "pending";

  const record: Record<string, NodeExecutionStatus> = {};
  for (const id of nodeIds) {
    record[id] = nodeStatus;
  }
  return Object.keys(record).length > 0 ? record : undefined;
}

/**
 * Derives per-node execution status from step-level progress.
 *
 * Mapping heuristic:
 * - Steps are keyed by `capId` (capability/tool id).
 * - Nodes are assigned step statuses in draft node order for each capId.
 *
 * If no step data is available, falls back to workflow-level status mapping.
 */
export function deriveNodeExecutionStatusFromSteps(
  workflowStatus: WorkflowDescribeStatus | null,
  nodes: Array<{ id: string; type: string }>,
  steps: WorkflowStepProgress[] | null | undefined
): Record<string, NodeExecutionStatus> | undefined {
  if (!workflowStatus) return undefined;
  const nodeIds = nodes.map((n) => n.id);
  const base = deriveNodeExecutionStatus(workflowStatus, nodeIds);
  if (!base) return undefined;

  const stepList = Array.isArray(steps) ? steps : [];
  if (stepList.length === 0) return base;

  const orderedSteps = stepList.slice().sort((a, b) => a.seq - b.seq);
  // Preferred mapping: explicit nodeId correlation from workflow payload.
  const hasNodeIds = orderedSteps.some((s) => typeof s.nodeId === "string" && s.nodeId.length > 0);
  if (hasNodeIds) {
    const out: Record<string, NodeExecutionStatus> = { ...base };
    for (const s of orderedSteps) {
      if (!s.nodeId) continue;
      out[s.nodeId] = s.status;
    }
    return Object.keys(out).length > 0 ? out : undefined;
  }

  const idsByCap = new Map<string, string[]>();
  for (const n of nodes) {
    if (!idsByCap.has(n.type)) idsByCap.set(n.type, []);
    idsByCap.get(n.type)!.push(n.id);
  }

  const cursorByCap = new Map<string, number>();
  const out: Record<string, NodeExecutionStatus> = { ...base };

  for (const s of orderedSteps) {
    const list = idsByCap.get(s.capId);
    if (!list || list.length === 0) continue;
    const idx = cursorByCap.get(s.capId) ?? 0;
    const nodeId = list[idx];
    if (!nodeId) continue;
    out[nodeId] = s.status;
    cursorByCap.set(s.capId, idx + 1);
  }

  return Object.keys(out).length > 0 ? out : undefined;
}
