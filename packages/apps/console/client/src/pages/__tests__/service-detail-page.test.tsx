import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router, Route } from "wouter";

import { ServiceDetailPage } from "../service-catalog";
import { getQueryFn } from "@/lib/queryClient";

describe("ServiceDetailPage", () => {
  const prevFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn(async (url: any) => {
      const u = String(url);
      if (u === "/api/services/svc-1") {
        return {
          ok: true,
          json: async () => ({
            service: {
              id: "svc-1",
              name: "API",
              description: "Public API",
              type: "api",
              tier: "tier1",
              health: "healthy",
              teamId: "t-1",
              dependencies: [],
              tags: ["api", "gateway"],
              openIncidents: 2,
              openVulnerabilities: 0,
            },
            team: { id: "t-1", name: "Platform", slug: "platform", lead: "alex" },
            dependencies: [],
            dependents: [],
          }),
        } as any;
      }
      throw new Error(`unexpected url ${u}`);
    }) as any;
  });

  afterEach(() => {
    global.fetch = prevFetch as any;
  });

  it("renders service details and drill-down links", async () => {
    window.history.pushState({}, "", "/services/svc-1");

    const qc = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          queryFn: getQueryFn({ on401: "throw" }),
        },
      },
    });

    render(
      <QueryClientProvider client={qc}>
        <Router>
          <Route path="/services/:id" component={ServiceDetailPage} />
        </Router>
      </QueryClientProvider>
    );

    await screen.findByTestId("service-detail-page");
    await screen.findByRole("heading", { name: /API/i });
    await screen.findByTestId("service-link-incidents");
    await screen.findByTestId("service-link-runbooks");
    await screen.findByTestId("service-link-executions");
  });
});

