/**
 * packages/apps/console/client/src/features/workbench/flow-adapters.ts
 * Pure helpers for converting BlueprintDraft to React Flow nodes/edges (Phase 4.4.3).
 */
import type { Edge, Node } from "@xyflow/react";
import type { BlueprintDraft, BlueprintEdge } from "@/features/workbench/types";
import type { DiffStatus } from "./draft-diff";
import type { BlueprintFlowNodeData } from "./blueprint-flow-node";
import type { NodeExecutionStatus } from "./live-canvas-state";

function edgeId(edge: { source: string; target: string; label?: string }): string {
  return `${edge.source}::${edge.target}::${edge.label ?? ""}`;
}

export function buildFlowNodesFromDraft(input: {
  draft: BlueprintDraft;
  prevPositions: Map<string, { x: number; y: number }>;
  nodeDiffStatus?: Record<string, DiffStatus>;
  nodeValidationStatus?: Record<string, "ghost" | "warning">;
  nodeExecutionStatus?: Record<string, NodeExecutionStatus>;
}): Array<Node<BlueprintFlowNodeData>> {
  return input.draft.nodes.map((node, index) => {
    const prev = input.prevPositions.get(node.id);
    const position = prev ?? { x: 250, y: index * 100 + 50 };

    return {
      id: node.id,
      type: "blueprint",
      data: {
        label: node.label,
        toolId: node.type,
        description: node.description,
        diffStatus: input.nodeDiffStatus?.[node.id],
        validationStatus: input.nodeValidationStatus?.[node.id],
        executionStatus: input.nodeExecutionStatus?.[node.id],
      },
      position,
    };
  });
}

export function buildFlowEdgesFromDraft(input: { edges: BlueprintEdge[] }): Edge[] {
  return input.edges.map((edge) => ({
    id: edgeId(edge),
    source: edge.source,
    target: edge.target,
    label: edge.label,
    type: "smoothstep",
  }));
}

