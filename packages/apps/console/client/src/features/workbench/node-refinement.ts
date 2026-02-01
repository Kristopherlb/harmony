/**
 * packages/apps/console/client/src/features/workbench/node-refinement.ts
 *
 * Builds the <workbench_node_refinement> payload for the agent.
 */
import type { BlueprintDraft } from "@/features/workbench/types";
import type { McpTool } from "@/features/workbench/use-mcp-tools";

export type WorkbenchNodeRefinementPayload = {
  kind: "workbench_node_refinement_v1";
  requestId: number;
  selectedNodeId: string;
  missingRequired: string[];
  tool: Pick<McpTool, "name" | "description" | "dataClassification" | "inputSchema" | "type"> | null;
  draft: BlueprintDraft;
};

export function buildWorkbenchNodeRefinementMessage(input: {
  requestId: number;
  selectedNodeId: string;
  missingRequired: string[];
  tool: WorkbenchNodeRefinementPayload["tool"];
  draft: BlueprintDraft;
}): string {
  const payload: WorkbenchNodeRefinementPayload = {
    kind: "workbench_node_refinement_v1",
    requestId: input.requestId,
    selectedNodeId: input.selectedNodeId,
    missingRequired: [...input.missingRequired].sort(),
    tool: input.tool,
    draft: input.draft,
  };

  return [
    "Please help me configure the selected node based on the schema and missingRequired list below.",
    "",
    "<workbench_node_refinement>",
    JSON.stringify(payload, null, 2),
    "</workbench_node_refinement>",
  ].join("\n");
}

