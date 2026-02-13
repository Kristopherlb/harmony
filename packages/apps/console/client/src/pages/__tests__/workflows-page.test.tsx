import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";

import { WorkflowListPage, WorkflowDetailPage } from "../workflows";
import { getQueryFn } from "@/lib/queryClient";

function renderWithProviders(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, queryFn: getQueryFn({ on401: "throw" }) },
    },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("Workflows pages", () => {
  const prevFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn(async (url: any, init?: any) => {
      const u = String(url);
      if (u === "/api/workflows") {
        return {
          ok: true,
          json: async () => [
            {
              workflowId: "wf-1",
              runId: "run-1",
              type: "blueprints.demo",
              status: "RUNNING",
              startTime: "2026-02-02T00:00:00.000Z",
              closeTime: null,
            },
          ],
        } as any;
      }
      if (u === "/api/workflows/wf-1") {
        return {
          ok: true,
          json: async () => ({
            workflowId: "wf-1",
            runId: "run-1",
            status: "RUNNING",
            type: "blueprints.demo",
            startTime: "2026-02-02T00:00:00.000Z",
            historyLength: 10,
          }),
        } as any;
      }
      if (u === "/api/workflows/wf-1/progress") {
        return {
          ok: true,
          json: async () => ({ workflowId: "wf-1", runId: "run-1", status: "RUNNING", steps: [] }),
        } as any;
      }
      if (u === "/api/workflows/wf-1/result") {
        return {
          ok: true,
          json: async () => ({ workflowId: "wf-1", runId: "run-1", status: "FAILED", error: "boom" }),
        } as any;
      }
      if (u === "/api/workflows/wf-1/cancel" && init?.method === "POST") {
        return { ok: true, json: async () => ({ ok: true, workflowId: "wf-1" }) } as any;
      }
      throw new Error(`unexpected url ${u}`);
    }) as any;
  });

  afterEach(() => {
    global.fetch = prevFetch as any;
  });

  it("lists workflows from GET /api/workflows", async () => {
    renderWithProviders(
      <Router>
        <WorkflowListPage />
      </Router>
    );

    await screen.findByText("wf-1");
    expect(screen.getByText("RUNNING")).toBeInTheDocument();
  });

  it("shows workflow detail and can cancel via POST /api/workflows/:id/cancel", async () => {
    renderWithProviders(
      <Router>
        <WorkflowDetailPage params={{ id: "wf-1" }} />
      </Router>
    );

    await screen.findByText("wf-1");
    fireEvent.click(screen.getByTestId("button-cancel-workflow"));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/workflows/wf-1/cancel",
        expect.objectContaining({ method: "POST" })
      );
    });
  });
});

