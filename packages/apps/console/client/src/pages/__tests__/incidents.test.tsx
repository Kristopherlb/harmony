import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";

import IncidentsPage, { IncidentDetailPage } from "../incidents";
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
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("IncidentsPage", () => {
  it("renders open incidents from the activity stream", async () => {
    const incidentId = "11111111-1111-1111-1111-111111111111";
    const fetchMock = vi.fn(async (url: any) => {
      if (String(url).startsWith("/api/activity/stream")) {
        return {
          ok: true,
          json: async () => ({
            events: [
              {
                id: incidentId,
                timestamp: "2026-02-02T00:00:00.000Z",
                source: "pagerduty",
                type: "alert",
                payload: {},
                severity: "critical",
                message: "API is down",
                resolved: false,
                contextType: "incident",
                serviceTags: ["api", "gateway"],
              },
            ],
            total: 1,
            page: 1,
            pageSize: 100,
          }),
        } as any;
      }
      throw new Error(`unexpected url ${String(url)}`);
    });

    const prevFetch = global.fetch;
    global.fetch = fetchMock as any;
    try {
      renderWithProviders(
        <Router>
          <IncidentsPage />
        </Router>
      );

      await screen.findByTestId("incidents-page");
      expect(screen.getByText("Incidents")).toBeInTheDocument();
      await screen.findByText("API is down");
      expect(screen.getByText("critical")).toBeInTheDocument();
      expect(screen.getByText("pagerduty")).toBeInTheDocument();
    } finally {
      global.fetch = prevFetch as any;
    }
  });
});

describe("IncidentDetailPage", () => {
  it("toggles resolved via PATCH /api/events/:id", async () => {
    const incidentId = "22222222-2222-2222-2222-222222222222";
    const fetchMock = vi.fn(async (url: any, init?: any) => {
      const u = String(url);
      if (u.startsWith("/api/activity/stream")) {
        return {
          ok: true,
          json: async () => ({
            events: [
              {
                id: incidentId,
                timestamp: "2026-02-02T00:00:00.000Z",
                source: "pagerduty",
                type: "alert",
                payload: {},
                severity: "high",
                message: "Degraded latency",
                resolved: false,
                contextType: "incident",
                serviceTags: ["api"],
              },
            ],
            total: 1,
            page: 1,
            pageSize: 200,
          }),
        } as any;
      }
      if (u === `/api/actions/approvals/pending?incidentId=${encodeURIComponent(incidentId)}`) {
        return { ok: true, json: async () => ({ executions: [], total: 0 }) } as any;
      }
      if (u === `/api/actions/executions?limit=100&incidentId=${encodeURIComponent(incidentId)}`) {
        return { ok: true, json: async () => ({ executions: [], total: 0 }) } as any;
      }
      if (u === "/api/actions/catalog") {
        return { ok: true, json: async () => ({ actions: [], categories: [] }) } as any;
      }
      if (u === `/api/events/${incidentId}` && init?.method === "PATCH") {
        return {
          ok: true,
          json: async () => ({ success: true }),
          text: async () => "ok",
          statusText: "ok",
          status: 200,
        } as any;
      }
      throw new Error(`unexpected url ${String(url)}`);
    });

    const prevFetch = global.fetch;
    global.fetch = fetchMock as any;
    try {
      renderWithProviders(
        <Router>
          <IncidentDetailPage params={{ id: incidentId }} />
        </Router>
      );

      await screen.findByText("Degraded latency");
      fireEvent.click(screen.getByTestId("button-toggle-resolved"));

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          `/api/events/${incidentId}`,
          expect.objectContaining({ method: "PATCH" })
        );
      });
    } finally {
      global.fetch = prevFetch as any;
    }
  });
});

