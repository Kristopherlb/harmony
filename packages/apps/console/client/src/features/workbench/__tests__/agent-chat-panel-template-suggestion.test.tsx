/**
 * packages/apps/console/client/src/features/workbench/__tests__/agent-chat-panel-template-suggestion.test.tsx
 * Unit test for template suggestion confirmation dialog (IMP-046).
 */
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Router } from "wouter";
import { AgentChatPanel } from "../agent-chat-panel";

vi.mock("@ai-sdk/react", () => {
  return {
    useChat: () => ({
      messages: [
        {
          id: "assistant-1",
          role: "assistant",
          parts: [
            {
              type: "text",
              text: "I can use a template.\n<templateId>incident-response-basic</templateId>",
            },
          ],
        },
      ],
      sendMessage: vi.fn(async () => {}),
      status: "ready",
    }),
  };
});

describe("AgentChatPanel template suggestion dialog", () => {
  it("opens confirmation dialog and navigates on confirm", async () => {
    let current = "/workbench";
    const useTestLocation = () => {
      const setLocation = (to: string) => {
        current = to;
      };
      return [current, setLocation] as const;
    };

    render(
      <Router hook={useTestLocation}>
        <AgentChatPanel onDraftGenerated={() => {}} />
      </Router>
    );

    // Dialog should appear from assistant marker
    await screen.findByTestId("template-suggestion-dialog");
    expect(screen.getByTestId("workbench-chat-mode")).toHaveTextContent(/template/i);

    fireEvent.click(screen.getByText("Load template"));
    expect(current).toBe("/workbench?templateId=incident-response-basic");
  });
});

