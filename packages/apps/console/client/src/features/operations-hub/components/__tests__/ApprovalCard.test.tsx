import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Router } from "wouter";

import { ApprovalCard } from "../ApprovalCard";

describe("ApprovalCard", () => {
  it("renders context badges and incident link when present", () => {
    const execId = "33333333-3333-3333-3333-333333333333";
    render(
      <Router>
        <ApprovalCard
          execution={{
            id: execId,
            runId: "run-1",
            actionId: "restart-pods",
            actionName: "Restart Pods",
            status: "pending_approval",
            params: { namespace: "production" },
            reasoning: "Mitigate outage",
            executedBy: "u1",
            executedByUsername: "alice",
            startedAt: "2026-02-02T00:00:00.000Z",
            context: {
              eventId: "11111111-1111-1111-1111-111111111111",
              contextType: "incident",
              serviceTags: ["api"],
            },
          }}
          onApprove={vi.fn()}
          onReject={vi.fn()}
          isPending={false}
        />
      </Router>
    );

    expect(screen.getByText("ctx:incident")).toBeInTheDocument();
    expect(screen.getByText("api")).toBeInTheDocument();
    expect(screen.getByTestId(`button-open-context-${execId}`)).toBeInTheDocument();
  });
});

