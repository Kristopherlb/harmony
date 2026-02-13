/**
 * packages/apps/console/client/src/features/workbench/__tests__/agent-chat-panel-budget.test.tsx
 * Cost/budget UX: Workbench allows setting budget key + policy.
 */
import React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Router } from "wouter";
import { AgentChatPanel } from "../agent-chat-panel";

const prefs = vi.hoisted(() => {
  return {
    defaultBudgetKey: null as string | null,
    setDefaultBudgetKey: vi.fn(),
  };
});

vi.mock("@/features/account/use-account-preferences", () => {
  return {
    useAccountPreferences: () => ({
      defaultBudgetKey: prefs.defaultBudgetKey,
      setDefaultBudgetKey: prefs.setDefaultBudgetKey,
      clearDefaultBudgetKey: vi.fn(),
      savedWorkflows: [],
      savedDashboards: [],
      addSavedWorkflow: vi.fn(),
      removeSavedWorkflow: vi.fn(),
      addSavedDashboard: vi.fn(),
      removeSavedDashboard: vi.fn(),
    }),
  };
});

vi.mock("@ai-sdk/react", () => {
  return {
    useChat: () => ({
      messages: [],
      sendMessage: vi.fn(async () => {}),
      status: "ready",
      error: null,
      setMessages: vi.fn(),
      clearError: vi.fn(),
    }),
  };
});

describe("AgentChatPanel budget controls", () => {
  const prevFetch = global.fetch;

  beforeEach(() => {
    prefs.defaultBudgetKey = null;
    prefs.setDefaultBudgetKey.mockReset();
    global.fetch = vi.fn(async (url: any, init: any) => {
      if (String(url) === "/api/workbench/cost/policy" && init?.method === "POST") {
        return { ok: true, json: async () => ({ ok: true }) } as any;
      }
      return { ok: true, json: async () => ({ budgetKey: "session:test", totals: { usd: 0, inputTokens: 0, outputTokens: 0 } }) } as any;
    }) as any;
  });

  afterEach(() => {
    global.fetch = prevFetch as any;
  });

  it("opens budget dialog and posts policy update", async () => {
    render(
      <Router>
        <AgentChatPanel onDraftGenerated={() => {}} />
      </Router>
    );

    fireEvent.click(screen.getByTestId("workbench-chat-budget-settings"));
    await screen.findByTestId("workbench-budget-dialog");

    fireEvent.change(screen.getByTestId("workbench-budget-key"), { target: { value: "user:U001" } });
    fireEvent.change(screen.getByTestId("workbench-budget-hard-limit"), { target: { value: "0.5" } });
    fireEvent.click(screen.getByTestId("workbench-budget-window-day"));

    fireEvent.click(screen.getByTestId("workbench-budget-apply"));

    expect(prefs.setDefaultBudgetKey).toHaveBeenCalledWith("user:U001");
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/workbench/cost/policy",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "content-type": "application/json" }),
      })
    );
  });
});

