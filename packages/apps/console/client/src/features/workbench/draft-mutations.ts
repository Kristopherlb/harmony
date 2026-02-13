/**
 * packages/apps/console/client/src/features/workbench/draft-mutations.ts
 *
 * Pure helpers for applying mutations to a BlueprintDraft.
 */
import type { BlueprintDraft } from "@/features/workbench/types";

export function updateDraftNodeProperties(input: {
  draft: BlueprintDraft;
  nodeId: string;
  nextProperties: Record<string, unknown>;
}): BlueprintDraft {
  return {
    ...input.draft,
    nodes: input.draft.nodes.map((n) =>
      n.id === input.nodeId ? { ...n, properties: input.nextProperties } : n
    ),
  };
}

function edgeKey(edge: { source: string; target: string; label?: string }): string {
  return `${edge.source}::${edge.target}::${edge.label ?? ""}`;
}

/**
 * Applies a proposed draft to the current one.
 * - Full replacements are kept when overlap is low.
 * - Refinement turns with high node overlap can be merged to avoid dropping
 *   unchanged nodes when the model returns a targeted partial update.
 */
export function applyDraftProposal(input: {
  current: BlueprintDraft | null;
  proposal: BlueprintDraft;
}): { draft: BlueprintDraft; mode: "full_replace" | "partial_merge" } {
  if (!input.current) return { draft: input.proposal, mode: "full_replace" };

  const currentIds = new Set(input.current.nodes.map((n) => n.id));
  const proposalIds = new Set(input.proposal.nodes.map((n) => n.id));
  const sharedIds = input.proposal.nodes.filter((n) => currentIds.has(n.id)).map((n) => n.id);

  const overlapRatio = currentIds.size > 0 ? sharedIds.length / currentIds.size : 0;
  const looksPartialRefinement =
    overlapRatio >= 0.3 && proposalIds.size > 0 && proposalIds.size < currentIds.size;
  if (!looksPartialRefinement) {
    return { draft: input.proposal, mode: "full_replace" };
  }

  const mergedNodeById = new Map(input.current.nodes.map((n) => [n.id, n]));
  for (const node of input.proposal.nodes) {
    mergedNodeById.set(node.id, node);
  }

  const mergedNodes = [...input.current.nodes]
    .map((n) => mergedNodeById.get(n.id) ?? n)
    .concat(input.proposal.nodes.filter((n) => !currentIds.has(n.id)));

  const mergedEdgesByKey = new Map(input.current.edges.map((e) => [edgeKey(e), e]));
  for (const edge of input.proposal.edges) {
    mergedEdgesByKey.set(edgeKey(edge), edge);
  }

  return {
    draft: {
      title: input.proposal.title || input.current.title,
      summary: input.proposal.summary || input.current.summary,
      nodes: mergedNodes,
      edges: [...mergedEdgesByKey.values()],
    },
    mode: "partial_merge",
  };
}

