/**
 * packages/apps/console/client/src/features/workbench/__tests__/draft-diff.test.ts
 * Unit tests for draft diff computation (Phase 4.2.2).
 */
import { describe, expect, it } from "vitest";
import { computeDraftDiff } from "../draft-diff";

describe("draft-diff", () => {
  it("marks all nodes as added when current is null", () => {
    const proposed = {
      title: "P",
      summary: "",
      nodes: [
        { id: "n1", label: "A", type: "trigger" },
        { id: "n2", label: "B", type: "action" },
      ],
      edges: [{ source: "n1", target: "n2" }],
    };
    const diff = computeDraftDiff(null, proposed);
    expect(diff.nodeStatus.n1).toBe("added");
    expect(diff.nodeStatus.n2).toBe("added");
    expect(diff.addedNodes).toBe(2);
    expect(diff.removedNodes).toBe(0);
  });

  it("marks unchanged nodes when draft is identical", () => {
    const draft = {
      title: "X",
      summary: "",
      nodes: [
        { id: "n1", label: "A", type: "trigger" },
        { id: "n2", label: "B", type: "action" },
      ],
      edges: [{ source: "n1", target: "n2" }],
    };
    const diff = computeDraftDiff(draft, { ...draft });
    expect(diff.nodeStatus.n1).toBe("unchanged");
    expect(diff.nodeStatus.n2).toBe("unchanged");
  });

  it("marks node as changed when label differs", () => {
    const current = {
      title: "X",
      summary: "",
      nodes: [
        { id: "n1", label: "A", type: "trigger" },
        { id: "n2", label: "B", type: "action" },
      ],
      edges: [{ source: "n1", target: "n2" }],
    };
    const proposed = {
      ...current,
      nodes: [
        { id: "n1", label: "A", type: "trigger" },
        { id: "n2", label: "B Updated", type: "action" },
      ],
    };
    const diff = computeDraftDiff(current, proposed);
    expect(diff.nodeStatus.n1).toBe("unchanged");
    expect(diff.nodeStatus.n2).toBe("changed");
    expect(diff.changedNodes).toBe(1);
  });

  it("marks new node as added and counts removed", () => {
    const current = {
      title: "X",
      summary: "",
      nodes: [
        { id: "n1", label: "A", type: "trigger" },
        { id: "n2", label: "B", type: "action" },
      ],
      edges: [{ source: "n1", target: "n2" }],
    };
    const proposed = {
      title: "X",
      summary: "",
      nodes: [
        { id: "n1", label: "A", type: "trigger" },
        { id: "n3", label: "C", type: "action" },
      ],
      edges: [
        { source: "n1", target: "n3" },
      ],
    };
    const diff = computeDraftDiff(current, proposed);
    expect(diff.nodeStatus.n1).toBe("unchanged");
    expect(diff.nodeStatus.n3).toBe("added");
    expect(diff.addedNodes).toBe(1);
    expect(diff.removedNodes).toBe(1);
  });
});
