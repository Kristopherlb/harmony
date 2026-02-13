/**
 * packages/apps/console/client/src/features/workbench/__tests__/agent-chat-panel-state-machine.test.tsx
 * Multi-turn chat state machine UX: status pill + new conversation reset.
 */
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Router } from "wouter";
import { AgentChatPanel } from "../agent-chat-panel";

const mocked = vi.hoisted(() => {
  return {
    messages: [] as any[],
    status: "ready" as string,
    error: null as any,
    setMessages: vi.fn(),
    clearError: vi.fn(),
  };
});

vi.mock("@ai-sdk/react", () => {
  return {
    useChat: () => ({
      messages: mocked.messages,
      sendMessage: vi.fn(async () => {}),
      status: mocked.status,
      error: mocked.error,
      setMessages: mocked.setMessages,
      clearError: mocked.clearError,
    }),
  };
});

describe("AgentChatPanel state machine UX", () => {
  it("renders a state pill derived from useChat.status", () => {
    mocked.messages = [];
    mocked.status = "submitted";
    mocked.error = null;

    render(
      <Router>
        <AgentChatPanel onDraftGenerated={() => {}} />
      </Router>
    );

    expect(screen.getByTestId("workbench-chat-state")).toHaveTextContent("Sending");
  });

  it("shows Monitoring mode when activeWorkflowId is present", () => {
    mocked.messages = [];
    mocked.status = "ready";
    mocked.error = null;

    render(
      <Router>
        <AgentChatPanel onDraftGenerated={() => {}} activeWorkflowId="wf-123" />
      </Router>
    );

    expect(screen.getByTestId("workbench-chat-mode")).toHaveTextContent(/monitor/i);
  });

  it("New resets messages when available", () => {
    mocked.messages = [];
    mocked.status = "ready";
    mocked.error = new Error("boom");

    render(
      <Router>
        <AgentChatPanel onDraftGenerated={() => {}} />
      </Router>
    );

    fireEvent.click(screen.getByTestId("workbench-chat-new"));
    expect(mocked.clearError).toHaveBeenCalled();
    expect(mocked.setMessages).toHaveBeenCalledWith([]);
  });

  it("shows recipe feedback controls and posts thumbs feedback", async () => {
    const prevFetch = global.fetch;
    mocked.messages = [
      {
        id: "assistant-1",
        role: "assistant",
        parts: [{ type: "text", text: "Generated workflow recommendation." }],
      },
    ];
    mocked.status = "ready";
    mocked.error = null;
    global.fetch = vi.fn(async (url: any, init?: any) => {
      if (String(url).startsWith("/api/workbench/recommendation-diagnostics")) {
        return {
          ok: true,
          json: async () => ({
            intent: "workflow_generation",
            weights: { incident_triage_comms: 2 },
            lastSelection: {
              primary: { recipeId: "incident_triage_comms", score: 17 },
              alternatives: [],
              rationale: ["keyword match"],
            },
          }),
        } as any;
      }
      if (String(url) === "/api/workbench/recipe-feedback") {
        return { ok: true, status: 204 } as any;
      }
      return { ok: true, json: async () => ({ budgetKey: "session:test", totals: { usd: 0, inputTokens: 0, outputTokens: 0 } }) } as any;
    }) as any;

    render(
      <Router>
        <AgentChatPanel onDraftGenerated={() => {}} />
      </Router>
    );

    expect(await screen.findByTestId("workbench-recipe-feedback")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("workbench-recipe-feedback-up"));
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/workbench/recipe-feedback",
      expect.objectContaining({ method: "POST" })
    );

    global.fetch = prevFetch as any;
  });
});

