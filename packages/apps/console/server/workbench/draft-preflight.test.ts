/**
 * packages/apps/console/server/workbench/draft-preflight.test.ts
 */
import { describe, it, expect } from "vitest";
import { preflightDraft } from "./draft-preflight";

describe("preflightDraft", () => {
  it("flags unknown tool types (excluding primitives)", () => {
    const report = preflightDraft({
      draft: {
        title: "t",
        summary: "s",
        nodes: [
          { id: "n0", label: "Start", type: "start" },
          { id: "n1", label: "X", type: "golden.unknown.tool" },
        ],
        edges: [],
      },
      tools: [
        {
          name: "golden.echo",
          dataClassification: "INTERNAL",
          inputSchema: { type: "object", properties: { x: { type: "number" } }, required: ["x"] },
        },
      ] as any,
    });

    expect(report.ok).toBe(false);
    expect(report.findings).toContainEqual(
      expect.objectContaining({
        kind: "unknown_tool",
        nodeId: "n1",
        toolId: "golden.unknown.tool",
      })
    );
  });

  it("flags missing required fields from tool input schema", () => {
    const report = preflightDraft({
      draft: {
        title: "t",
        summary: "s",
        nodes: [{ id: "n1", label: "Echo", type: "golden.echo", properties: {} }],
        edges: [],
      },
      tools: [
        {
          name: "golden.echo",
          dataClassification: "INTERNAL",
          inputSchema: { type: "object", properties: { x: { type: "number" } }, required: ["x"] },
        },
      ] as any,
    });

    expect(report.ok).toBe(false);
    expect(report.findings).toContainEqual(
      expect.objectContaining({
        kind: "missing_required",
        nodeId: "n1",
        toolId: "golden.echo",
        field: "x",
      })
    );
  });

  it("flags restricted tools when not approved", () => {
    const report = preflightDraft({
      draft: {
        title: "t",
        summary: "s",
        nodes: [{ id: "n1", label: "Danger", type: "golden.some.restricted", properties: { manifest: {} } }],
        edges: [],
      },
      tools: [
        {
          name: "golden.some.restricted",
          dataClassification: "RESTRICTED",
          inputSchema: { type: "object", properties: { manifest: { type: "object" } }, required: ["manifest"] },
        },
      ] as any,
      policy: { approvedRestricted: false },
    });

    expect(report.ok).toBe(false);
    expect(report.findings).toContainEqual(
      expect.objectContaining({
        kind: "restricted_requires_approval",
        nodeId: "n1",
        toolId: "golden.some.restricted",
      })
    );
  });

  it("warns when a tool is critical (peer approval during execution)", () => {
    const report = preflightDraft({
      draft: {
        title: "t",
        summary: "s",
        nodes: [{ id: "n1", label: "Apply", type: "golden.k8s.apply", properties: { manifest: {} } }],
        edges: [],
      },
      tools: [
        {
          name: "golden.k8s.apply",
          dataClassification: "RESTRICTED",
          inputSchema: { type: "object", properties: { manifest: { type: "object" } }, required: ["manifest"] },
        },
      ] as any,
      policy: { approvedRestricted: false },
    });

    expect(report.ok).toBe(true);
    expect(report.warnings).toContainEqual(
      expect.objectContaining({
        kind: "critical_requires_peer_approval",
        nodeId: "n1",
        toolId: "golden.k8s.apply",
      })
    );
  });
});

