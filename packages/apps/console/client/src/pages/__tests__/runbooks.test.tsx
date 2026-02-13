import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";

import RunbooksPage from "../runbooks";
import { getQueryFn } from "@/lib/queryClient";

function renderWithProviders(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: getQueryFn({ on401: "throw" }),
      },
    },
  });
  return render(
    <QueryClientProvider client={qc}>
      <Router>{ui}</Router>
    </QueryClientProvider>
  );
}

describe("RunbooksPage", () => {
  it("loads runbooks and shows executable badge when matching action exists", async () => {
    const fetchMock = vi.fn(async (url: any) => {
      const u = String(url);
      if (u === "/api/runbooks") {
        return {
          ok: true,
          json: async () => ({
            runbooks: [
              {
                id: "redis-restart",
                title: "Redis Restart",
                filename: "redis-restart.md",
                updatedAt: "2026-02-02T00:00:00.000Z",
              },
            ],
          }),
        } as any;
      }
      if (u === "/api/actions/catalog") {
        return {
          ok: true,
          json: async () => ({
            actions: [
              {
                id: "redis-restart",
                name: "Redis Restart",
                description: "Restart Redis cluster with health checks",
                category: "remediation",
                riskLevel: "high",
                requiredParams: [],
                requiredRoles: ["sre"],
                targetServices: ["redis"],
                contextTypes: ["incident"],
              },
            ],
            categories: [],
          }),
        } as any;
      }
      if (u === "/api/runbooks/redis-restart") {
        return {
          ok: true,
          json: async () => ({
            id: "redis-restart",
            title: "Redis Restart",
            filename: "redis-restart.md",
            updatedAt: "2026-02-02T00:00:00.000Z",
            content: "# Redis Restart\n\nSteps…\n\n[Docs](javascript:alert(1))\n",
          }),
        } as any;
      }
      throw new Error(`unexpected url ${u}`);
    });

    const prevFetch = global.fetch;
    global.fetch = fetchMock as any;
    try {
      renderWithProviders(<RunbooksPage />);

      await screen.findByTestId("runbooks-page");
      await screen.findByText("Redis Restart");

      fireEvent.click(screen.getByTestId("runbook-row-redis-restart"));
      await screen.findByText("Steps…");

      expect(screen.getByText("executable")).toBeInTheDocument();
      expect(screen.getByTestId("button-execute-runbook")).not.toBeDisabled();

      // Safety: ensure javascript: links are not preserved.
      expect(screen.getByText("Docs").closest("a")).toHaveAttribute("href", "#");
    } finally {
      global.fetch = prevFetch as any;
    }
  });
});

