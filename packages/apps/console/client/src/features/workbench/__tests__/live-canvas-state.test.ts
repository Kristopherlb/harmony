/**
 * packages/apps/console/client/src/features/workbench/__tests__/live-canvas-state.test.ts
 * Unit tests for live-canvas-state (Phase 4.3.4).
 */
import { describe, it, expect } from "vitest";
import {
  deriveNodeExecutionStatus,
  deriveNodeExecutionStatusFromSteps,
  type WorkflowDescribeStatus,
} from "../live-canvas-state";

describe("live-canvas-state", () => {
  describe("deriveNodeExecutionStatus", () => {
    it("returns undefined when workflowStatus is null", () => {
      expect(deriveNodeExecutionStatus(null, ["n1", "n2"])).toBeUndefined();
    });

    it("maps RUNNING to running for all nodes", () => {
      const status: WorkflowDescribeStatus = { status: "RUNNING" };
      const out = deriveNodeExecutionStatus(status, ["n1", "n2"]);
      expect(out).toEqual({ n1: "running", n2: "running" });
    });

    it("maps COMPLETED to completed for all nodes", () => {
      const status: WorkflowDescribeStatus = { status: "COMPLETED" };
      const out = deriveNodeExecutionStatus(status, ["a", "b", "c"]);
      expect(out).toEqual({ a: "completed", b: "completed", c: "completed" });
    });

    it("maps FAILED to failed for all nodes", () => {
      const status: WorkflowDescribeStatus = { status: "FAILED" };
      const out = deriveNodeExecutionStatus(status, ["n1"]);
      expect(out).toEqual({ n1: "failed" });
    });

    it("maps CANCELED and TERMINATED to failed", () => {
      expect(deriveNodeExecutionStatus({ status: "CANCELED" }, ["n1"])).toEqual({
        n1: "failed",
      });
      expect(deriveNodeExecutionStatus({ status: "TERMINATED" }, ["n1"])).toEqual({
        n1: "failed",
      });
    });

    it("returns undefined when nodeIds is empty", () => {
      const status: WorkflowDescribeStatus = { status: "RUNNING" };
      expect(deriveNodeExecutionStatus(status, [])).toBeUndefined();
    });
  });

  describe("deriveNodeExecutionStatusFromSteps", () => {
    it("prefers explicit nodeId correlation when present", () => {
      const status: WorkflowDescribeStatus = { status: "RUNNING" };
      const nodes = [
        { id: "n1", type: "cap.one" },
        { id: "n2", type: "cap.two" },
      ];
      const steps = [
        { seq: 10, activityId: "a1", capId: "cap.one", nodeId: "n2", status: "running" as const },
        { seq: 20, activityId: "a2", capId: "cap.one", nodeId: "n1", status: "completed" as const },
      ];

      expect(deriveNodeExecutionStatusFromSteps(status, nodes, steps)).toEqual({
        n1: "completed",
        n2: "running",
      });
    });

    it("maps capability step progress onto node ids (by node.type) in node order", () => {
      const status: WorkflowDescribeStatus = { status: "RUNNING" };
      const nodes = [
        { id: "n1", type: "cap.one" },
        { id: "n2", type: "cap.two" },
        { id: "n3", type: "cap.one" },
      ];
      const steps = [
        { seq: 10, activityId: "a1", capId: "cap.one", status: "completed" as const },
        { seq: 20, activityId: "a2", capId: "cap.two", status: "running" as const },
        { seq: 30, activityId: "a3", capId: "cap.one", status: "pending" as const },
      ];

      expect(deriveNodeExecutionStatusFromSteps(status, nodes, steps)).toEqual({
        n1: "completed",
        n2: "running",
        n3: "pending",
      });
    });

    it("falls back to workflow-level status when steps are missing", () => {
      const status: WorkflowDescribeStatus = { status: "COMPLETED" };
      const nodes = [{ id: "n1", type: "cap.one" }];
      expect(deriveNodeExecutionStatusFromSteps(status, nodes, [])).toEqual({ n1: "completed" });
    });
  });
});
