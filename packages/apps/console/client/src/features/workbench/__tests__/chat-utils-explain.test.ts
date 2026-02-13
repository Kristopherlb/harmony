/**
 * packages/apps/console/client/src/features/workbench/__tests__/chat-utils-explain.test.ts
 * Unit tests for getExplainStepFromMessage (Phase 4.2.3).
 */
import { describe, expect, it } from "vitest";
import { getExplainStepFromMessage } from "../chat-utils";

describe("chat-utils getExplainStepFromMessage", () => {
  it("extracts explainStep from tool-explainStep part", () => {
    const msg = {
      role: "assistant",
      parts: [
        {
          type: "tool-explainStep",
          state: "output-available",
          output: { nodeId: "n1", explanation: "This step creates the Jira ticket." },
        },
      ],
    };
    const result = getExplainStepFromMessage(msg);
    expect(result).toEqual({ nodeId: "n1", explanation: "This step creates the Jira ticket." });
  });

  it("returns null when no explainStep part", () => {
    const msg = { role: "assistant", parts: [{ type: "text", text: "hello" }] };
    expect(getExplainStepFromMessage(msg)).toBeNull();
  });

  it("returns null when output is invalid", () => {
    const msg = {
      role: "assistant",
      parts: [
        { type: "tool-explainStep", state: "output-available", output: { nodeId: "n1" } },
      ],
    };
    expect(getExplainStepFromMessage(msg)).toBeNull();
  });
});
