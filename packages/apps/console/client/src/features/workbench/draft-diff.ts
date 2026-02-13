/**
 * packages/apps/console/client/src/features/workbench/draft-diff.ts
 *
 * Computes incremental diff between current and proposed drafts (Phase 4.2.2).
 * Used to highlight added, removed, and changed nodes/edges on the canvas.
 */

import type { BlueprintDraft, BlueprintNode } from "./types";

function nodeKey(n: BlueprintNode): string {
  return `${n.id}::${n.label}::${n.type}::${JSON.stringify(n.properties ?? {})}`;
}

function edgeKey(edge: { source: string; target: string; label?: string }): string {
  return `${edge.source}::${edge.target}::${edge.label ?? ""}`;
}

export type DiffStatus = "added" | "removed" | "changed" | "unchanged";

export interface DraftDiff {
  /** Node id -> status for nodes in the proposed draft */
  nodeStatus: Record<string, DiffStatus>;
  /** Edge key (source::target::label) -> status for edges in the proposed draft */
  edgeStatus: Record<string, DiffStatus>;
  /** Counts for summary */
  addedNodes: number;
  removedNodes: number;
  changedNodes: number;
  addedEdges: number;
  removedEdges: number;
  changedEdges: number;
}

/**
 * Computes the diff between current and proposed drafts.
 * When current is null, all proposed nodes/edges are "added".
 */
export function computeDraftDiff(
  current: BlueprintDraft | null,
  proposed: BlueprintDraft
): DraftDiff {
  const nodeStatus: Record<string, DiffStatus> = {};
  const edgeStatus: Record<string, DiffStatus> = {};
  let addedNodes = 0;
  let removedNodes = 0;
  let changedNodes = 0;
  let addedEdges = 0;
  let removedEdges = 0;
  let changedEdges = 0;

  const currentNodes = current ? new Map(current.nodes.map((n) => [n.id, n])) : new Map<string, BlueprintNode>();
  const currentEdges = current
    ? new Map(current.edges.map((e) => [edgeKey(e), e]))
    : new Map<string, { source: string; target: string; label?: string }>();

  for (const node of proposed.nodes) {
    const prev = currentNodes.get(node.id);
    if (!prev) {
      nodeStatus[node.id] = "added";
      addedNodes++;
    } else if (nodeKey(prev) !== nodeKey(node)) {
      nodeStatus[node.id] = "changed";
      changedNodes++;
    } else {
      nodeStatus[node.id] = "unchanged";
    }
  }

  for (const node of current?.nodes ?? []) {
    if (!proposed.nodes.some((n) => n.id === node.id)) {
      removedNodes++;
    }
  }

  for (const edge of proposed.edges) {
    const key = edgeKey(edge);
    const prev = currentEdges.get(key);
    if (!prev) {
      edgeStatus[key] = "added";
      addedEdges++;
    } else {
      edgeStatus[key] = "unchanged";
    }
  }

  for (const edge of current?.edges ?? []) {
    const key = edgeKey(edge);
    if (!edgeStatus[key]) {
      removedEdges++;
    }
  }

  return {
    nodeStatus,
    edgeStatus,
    addedNodes,
    removedNodes,
    changedNodes,
    addedEdges,
    removedEdges,
    changedEdges,
  };
}
