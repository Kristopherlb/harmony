import { describe, expect, it } from "vitest";

import { buildWorkbenchNodeRefinementMessage } from "@/features/workbench/node-refinement";
import type { BlueprintDraft } from "@/features/workbench/types";

describe("workbench node-refinement message", () => {
  it("wraps a JSON payload in <workbench_node_refinement> tags", () => {
    const draft: BlueprintDraft = {
      title: "Demo",
      summary: "demo",
      nodes: [{ id: "n1", label: "Jira Search", type: "jira.search_issues", properties: {} }],
      edges: [],
    };

    const text = buildWorkbenchNodeRefinementMessage({
      requestId: 1,
      selectedNodeId: "n1",
      missingRequired: ["jql"],
      tool: null,
      draft,
    });

    expect(text).toContain("<workbench_node_refinement>");
    expect(text).toContain("</workbench_node_refinement>");

    const jsonStr = text.split("<workbench_node_refinement>")[1]!.split("</workbench_node_refinement>")[0]!.trim();
    const payload = JSON.parse(jsonStr) as any;
    expect(payload.kind).toBe("workbench_node_refinement_v1");
    expect(payload.selectedNodeId).toBe("n1");
    expect(payload.missingRequired).toEqual(["jql"]);
    expect(payload.draft?.title).toBe("Demo");
  });
});

