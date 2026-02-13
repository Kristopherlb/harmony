/**
 * packages/apps/console/server/agent/execution-monitor.test.ts
 * Unit tests for execution-monitor (Phase 4.3.4).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getExecutionStatus,
  cancelExecution,
  formatExecutionStatusForChat,
  isStatusQuery,
  isCancelQuery,
  type WorkflowDescribe,
} from "./execution-monitor";

vi.mock("../services/temporal/temporal-client.js", () => ({
  getTemporalClient: vi.fn(),
}));

describe("execution-monitor", () => {
  describe("formatExecutionStatusForChat", () => {
    it("formats describe with start and close time", () => {
      const describe: WorkflowDescribe = {
        workflowId: "wf-1",
        runId: "run-1",
        status: "COMPLETED",
        type: "echoWorkflow",
        startTime: "2026-02-02T10:00:00.000Z",
        closeTime: "2026-02-02T10:00:05.000Z",
        historyLength: 10,
      };
      const out = formatExecutionStatusForChat(describe);
      expect(out).toContain("Workflow: wf-1");
      expect(out).toContain("Status: COMPLETED");
      expect(out).toContain("Type: echoWorkflow");
      expect(out).toContain("Run ID: run-1");
      expect(out).toContain("Started:");
      expect(out).toContain("Closed:");
      expect(out).toContain("Duration:");
      expect(out).toContain("History events: 10");
    });

    it("formats describe with only start time (running)", () => {
      const describe: WorkflowDescribe = {
        workflowId: "wf-2",
        runId: "run-2",
        status: "RUNNING",
        type: "mathPipeline",
      };
      const out = formatExecutionStatusForChat(describe);
      expect(out).toContain("Status: RUNNING");
    });
  });

  describe("isStatusQuery", () => {
    it("returns true for status-like phrases", () => {
      expect(isStatusQuery("what's the status?")).toBe(true);
      expect(isStatusQuery("What is the status")).toBe(true);
      expect(isStatusQuery("workflow status")).toBe(true);
      expect(isStatusQuery("how's the run")).toBe(true);
      expect(isStatusQuery("status?")).toBe(true);
    });

    it("returns false for non-status messages", () => {
      expect(isStatusQuery("create a workflow")).toBe(false);
      expect(isStatusQuery("cancel the workflow")).toBe(false);
    });
  });

  describe("isCancelQuery", () => {
    it("returns true for cancel-like phrases", () => {
      expect(isCancelQuery("cancel the workflow")).toBe(true);
      expect(isCancelQuery("stop the run")).toBe(true);
      expect(isCancelQuery("terminate the workflow")).toBe(true);
    });

    it("returns false for non-cancel messages", () => {
      expect(isCancelQuery("what's the status?")).toBe(false);
      expect(isCancelQuery("create a workflow")).toBe(false);
    });
  });

  describe("getExecutionStatus", () => {
    beforeEach(async () => {
      const temporal = await import("../services/temporal/temporal-client.js");
      vi.mocked(temporal.getTemporalClient).mockResolvedValue({
        getHandle: (_id: string) => ({
          describe: vi.fn().mockResolvedValue({
            workflowId: _id,
            runId: "run-1",
            status: { name: "RUNNING" },
            type: "echoWorkflow",
            startTime: new Date().toISOString(),
            closeTime: undefined,
            historyLength: 5,
          }),
        }),
      } as any);
    });

    it("returns formatted status string", async () => {
      const out = await getExecutionStatus("wf-123");
      expect(out).toContain("Workflow: wf-123");
      expect(out).toContain("Status: RUNNING");
    });

    it("returns error message on failure", async () => {
      const temporal = await import("../services/temporal/temporal-client.js");
      vi.mocked(temporal.getTemporalClient).mockRejectedValue(new Error("Connection refused"));
      const out = await getExecutionStatus("wf-123");
      expect(out).toContain("Failed to get workflow status");
      expect(out).toContain("Connection refused");
    });
  });

  describe("cancelExecution", () => {
    beforeEach(async () => {
      const temporal = await import("../services/temporal/temporal-client.js");
      vi.mocked(temporal.getTemporalClient).mockResolvedValue({
        getHandle: () => ({
          terminate: vi.fn().mockResolvedValue(undefined),
        }),
      } as any);
    });

    it("returns ok when terminate succeeds", async () => {
      const result = await cancelExecution("wf-123");
      expect(result).toEqual({ ok: true });
    });

    it("returns error when terminate fails", async () => {
      const temporal = await import("../services/temporal/temporal-client.js");
      vi.mocked(temporal.getTemporalClient).mockResolvedValue({
        getHandle: () => ({
          terminate: vi.fn().mockRejectedValue(new Error("Workflow not found")),
        }),
      } as any);
      const result = await cancelExecution("wf-123");
      expect(result.ok).toBe(false);
      expect(result.error).toContain("Workflow not found");
    });
  });
});
