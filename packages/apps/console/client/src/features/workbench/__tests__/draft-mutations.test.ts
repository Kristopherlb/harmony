import { describe, expect, it } from "vitest";
import type { BlueprintDraft } from "../types";
import { applyDraftProposal, updateDraftNodeProperties } from "../draft-mutations";

const baseDraft: BlueprintDraft = {
  title: "Base",
  summary: "base summary",
  nodes: [
    { id: "n1", label: "Start", type: "start" },
    { id: "n2", label: "Notify", type: "golden.slack.post_message", properties: { channel: "#ops" } },
    { id: "n3", label: "Ticket", type: "golden.jira.create_issue", properties: { project: "OPS" } },
  ],
  edges: [
    { source: "n1", target: "n2" },
    { source: "n2", target: "n3" },
  ],
};

describe("draft-mutations", () => {
  it("updates node properties in place", () => {
    const next = updateDraftNodeProperties({
      draft: baseDraft,
      nodeId: "n2",
      nextProperties: { channel: "#alerts" },
    });
    const n2 = next.nodes.find((n) => n.id === "n2");
    expect(n2?.properties).toEqual({ channel: "#alerts" });
  });

  it("merges partial proposal onto current draft for refinement turns", () => {
    const partialProposal: BlueprintDraft = {
      title: "Base",
      summary: "base summary",
      nodes: [{ id: "n2", label: "Notify", type: "golden.slack.post_message", properties: { channel: "#alerts" } }],
      edges: [],
    };

    const result = applyDraftProposal({
      current: baseDraft,
      proposal: partialProposal,
    });

    expect(result.mode).toBe("partial_merge");
    expect(result.draft.nodes).toHaveLength(3);
    expect(result.draft.nodes.find((n) => n.id === "n2")?.properties).toEqual({ channel: "#alerts" });
    expect(result.draft.nodes.find((n) => n.id === "n3")).toBeTruthy();
  });

  it("uses full replace when proposal has little overlap", () => {
    const replacement: BlueprintDraft = {
      title: "Replacement",
      summary: "new flow",
      nodes: [{ id: "x1", label: "Only", type: "start" }],
      edges: [],
    };

    const result = applyDraftProposal({
      current: baseDraft,
      proposal: replacement,
    });

    expect(result.mode).toBe("full_replace");
    expect(result.draft.title).toBe("Replacement");
    expect(result.draft.nodes).toHaveLength(1);
  });
});
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

