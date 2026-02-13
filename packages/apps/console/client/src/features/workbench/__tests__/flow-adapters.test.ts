/**
 * packages/apps/console/client/src/features/workbench/__tests__/flow-adapters.test.ts
 * Unit tests for converting BlueprintDraft -> ReactFlow nodes/edges (Phase 4.4.3).
 */
import { describe, expect, it } from "vitest";
import { buildFlowEdgesFromDraft, buildFlowNodesFromDraft } from "../flow-adapters";

describe("flow-adapters", () => {
  it("preserves prior node positions when provided", () => {
    const draft = {
      title: "t",
      summary: "s",
      nodes: [
        { id: "a", label: "A", type: "start" },
        { id: "b", label: "B", type: "log" },
      ],
      edges: [{ source: "a", target: "b" }],
    };

    const nodes = buildFlowNodesFromDraft({
      draft,
      prevPositions: new Map([
        ["a", { x: 10, y: 20 }],
        ["b", { x: 30, y: 40 }],
      ]),
    });

    expect(nodes.find((n) => n.id === "a")?.position).toEqual({ x: 10, y: 20 });
    expect(nodes.find((n) => n.id === "b")?.position).toEqual({ x: 30, y: 40 });
  });

  it("assigns deterministic fallback positions when missing", () => {
    const draft = {
      title: "t",
      summary: "s",
      nodes: [
        { id: "a", label: "A", type: "start" },
        { id: "b", label: "B", type: "log" },
      ],
      edges: [{ source: "a", target: "b" }],
    };

    const nodes = buildFlowNodesFromDraft({ draft, prevPositions: new Map() });
    expect(nodes[0]?.position).toEqual({ x: 250, y: 50 });
    expect(nodes[1]?.position).toEqual({ x: 250, y: 150 });
  });

  it("builds stable edges from source/target/label", () => {
    const edges = buildFlowEdgesFromDraft({
      edges: [
        { source: "a", target: "b", label: "then" },
        { source: "b", target: "c" },
      ],
    });
    expect(edges.map((e) => e.id)).toEqual(["a::b::then", "b::c::"]);
  });

  it("includes executionStatus when provided", () => {
    const draft = {
      title: "t",
      summary: "s",
      nodes: [
        { id: "a", label: "A", type: "cap.one" },
        { id: "b", label: "B", type: "cap.two" },
      ],
      edges: [],
    };

    const nodes = buildFlowNodesFromDraft({
      draft,
      prevPositions: new Map(),
      nodeExecutionStatus: { a: "running", b: "completed" },
    });

    expect(nodes.find((n) => n.id === "a")?.data).toMatchObject({ executionStatus: "running" });
    expect(nodes.find((n) => n.id === "b")?.data).toMatchObject({ executionStatus: "completed" });
  });

  it("includes background validation status when provided", () => {
    const draft = {
      title: "t",
      summary: "s",
      nodes: [
        { id: "a", label: "A", type: "cap.one" },
        { id: "b", label: "B", type: "cap.two" },
      ],
      edges: [],
    };

    const nodes = buildFlowNodesFromDraft({
      draft,
      prevPositions: new Map(),
      nodeValidationStatus: { a: "ghost", b: "warning" },
    });

    expect(nodes.find((n) => n.id === "a")?.data).toMatchObject({ validationStatus: "ghost" });
    expect(nodes.find((n) => n.id === "b")?.data).toMatchObject({ validationStatus: "warning" });
  });
});

