import { describe, expect, it } from "vitest";

import { updateDraftNodeProperties } from "@/features/workbench/draft-mutations";
import type { BlueprintDraft } from "@/features/workbench/types";

describe("workbench draft-mutations", () => {
  it("updates only the selected node's properties", () => {
    const draft: BlueprintDraft = {
      title: "Demo",
      summary: "demo",
      nodes: [
        { id: "n1", label: "A", type: "tool.a", properties: { a: 1 } },
        { id: "n2", label: "B", type: "tool.b", properties: { b: 2 } },
      ],
      edges: [{ source: "n1", target: "n2" }],
    };

    const next = updateDraftNodeProperties({
      draft,
      nodeId: "n2",
      nextProperties: { b: 3, c: "x" },
    });

    expect(next).not.toBe(draft);
    expect(next.nodes.find((n) => n.id === "n1")?.properties).toEqual({ a: 1 });
    expect(next.nodes.find((n) => n.id === "n2")?.properties).toEqual({ b: 3, c: "x" });
    expect(next.edges).toEqual(draft.edges);
  });
});

