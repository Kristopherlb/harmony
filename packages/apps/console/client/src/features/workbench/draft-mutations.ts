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

