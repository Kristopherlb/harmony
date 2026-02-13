import React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { Router } from "wouter";
import { RunDraftDialog } from "../run-draft-dialog";
import type { BlueprintDraft } from "../types";

const emitWorkbenchEventMock = vi.fn(async () => {});

vi.mock("@/lib/workbench-telemetry", () => ({
  emitWorkbenchEvent: (payload: unknown) => emitWorkbenchEventMock(payload),
}));

vi.mock("../execution-timeline", () => ({
  ExecutionTimeline: ({ workflowId }: { workflowId: string }) => (
    <div data-testid="execution-timeline">timeline:{workflowId}</div>
  ),
}));

describe("RunDraftDialog telemetry parity", () => {
  const draft: BlueprintDraft = {
    title: "Draft telemetry",
    summary: "Telemetry parity test",
    nodes: [{ id: "n1", label: "Echo", type: "golden.echo", properties: { x: 1 } }],
    edges: [],
  };

  let nowMs = 0;

  beforeEach(() => {
    nowMs = Date.parse("2026-02-10T00:00:00.000Z");
    vi.spyOn(Date, "now").mockImplementation(() => nowMs);
    emitWorkbenchEventMock.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("emits run started + completed with duration for draft runs", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url === "/api/workbench/drafts/preflight" && init?.method === "POST") {
        return new Response(JSON.stringify({ ok: true, findings: [], warnings: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url === "/api/workbench/drafts/run" && init?.method === "POST") {
        return new Response(
          JSON.stringify({
            workflowId: "wf-draft-1",
            runId: "run-1",
            taskQueue: "golden-tools",
            workflowType: "workbenchDraftRunWorkflow",
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      if (url === "/api/workflows/wf-draft-1/approval") {
        return new Response(JSON.stringify({ state: { status: "none" } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url === "/api/workflows/wf-draft-1") {
        return new Response(
          JSON.stringify({
            workflowId: "wf-draft-1",
            runId: "run-1",
            status: "COMPLETED",
            type: "workbenchDraftRunWorkflow",
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    vi.stubGlobal("fetch", fetchMock);

    render(
      <Router>
        <RunDraftDialog draft={draft} />
      </Router>
    );

    fireEvent.click(screen.getByTestId("workbench-run-draft-open"));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/workbench/drafts/preflight",
        expect.objectContaining({ method: "POST" })
      );
    });

    fireEvent.click(screen.getByTestId("workbench-run-draft-submit"));

    await waitFor(() => {
      expect(emitWorkbenchEventMock).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "workbench.workflow_run_started",
          runId: "run-1",
          draftId: "current",
        })
      );
    });

    nowMs = Date.parse("2026-02-10T00:00:05.000Z");
    await new Promise((resolve) => setTimeout(resolve, 1200));

    await waitFor(() => {
      expect(emitWorkbenchEventMock).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "workbench.workflow_run_completed",
          runId: "run-1",
          workflowId: "wf-draft-1",
          status: "completed",
          durationMs: 5000,
        })
      );
    });
  });
});
