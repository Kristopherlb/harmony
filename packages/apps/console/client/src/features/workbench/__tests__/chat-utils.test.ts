import { describe, it, expect } from "vitest";
import { getDraftFromAssistantMessage, getMessageText } from "../chat-utils";

describe("workbench chat utils", () => {
  it("getMessageText concatenates text parts", () => {
    const msg: any = {
      parts: [
        { type: "text", text: "Hello" },
        { type: "tool-proposeWorkflow", state: "input-available", input: {} },
        { type: "text", text: " world" },
      ],
    };

    expect(getMessageText(msg)).toBe("Hello world");
  });

  it("getMessageText falls back to legacy content string", () => {
    const msg: any = { content: "Legacy content" };
    expect(getMessageText(msg)).toBe("Legacy content");
  });

  it("getDraftFromAssistantMessage extracts draft from tool output", () => {
    const msg: any = {
      parts: [
        { type: "text", text: "Draft ready." },
        {
          type: "tool-proposeWorkflow",
          toolCallId: "call-1",
          state: "output-available",
          input: {},
          output: {
            title: "My Workflow",
            summary: "A simple flow",
            nodes: [{ id: "trigger_1", label: "Trigger", type: "trigger", properties: {} }],
            edges: [],
          },
        },
      ],
    };

    const draft = getDraftFromAssistantMessage(msg);
    expect(draft?.title).toBe("My Workflow");
    expect(draft?.nodes.length).toBe(1);
  });

  it("getDraftFromAssistantMessage extracts draft from dynamic-tool output", () => {
    const msg: any = {
      parts: [
        { type: "dynamic-tool", toolName: "proposeWorkflow", toolCallId: "call-1", state: "output-available", output: {
          title: "Dynamic Draft",
          summary: "",
          nodes: [{ id: "n1", label: "Start", type: "trigger", properties: {} }],
          edges: [],
        } },
      ],
    };

    const draft = getDraftFromAssistantMessage(msg);
    expect(draft?.title).toBe("Dynamic Draft");
  });

  it("getDraftFromAssistantMessage supports legacy toolInvocations.result", () => {
    const msg: any = {
      content: "",
      toolInvocations: [
        {
          toolName: "proposeWorkflow",
          result: {
            title: "Legacy Draft",
            summary: "From toolInvocations",
            nodes: [{ id: "n1", label: "Start", type: "trigger", properties: {} }],
            edges: [],
          },
        },
      ],
    };

    const draft = getDraftFromAssistantMessage(msg);
    expect(draft?.title).toBe("Legacy Draft");
  });

  it("getDraftFromAssistantMessage falls back to parsing JSON text", () => {
    const msg: any = {
      parts: [
        {
          type: "text",
          text: JSON.stringify({
            title: "JSON Workflow",
            summary: "From JSON",
            nodes: [{ id: "n1", label: "Start", type: "trigger", properties: {} }],
            edges: [],
          }),
        },
      ],
    };

    const draft = getDraftFromAssistantMessage(msg);
    expect(draft?.title).toBe("JSON Workflow");
  });
});

