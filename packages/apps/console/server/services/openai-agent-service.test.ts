import { describe, it, expect } from "vitest";
import { convertToModelMessages } from "ai";
import { buildBlueprintPlanningPrompt, normalizeIncomingMessages } from "./openai-agent-service";

describe("OpenAIAgentService prompt normalization", () => {
  it("normalizes mixed {content} + {parts} shapes without throwing", async () => {
    const rawMessages: any[] = [
      { id: "u1", role: "user", content: "bloop" },
      {
        id: "a1",
        role: "assistant",
        parts: [
          { type: "step-start" },
          {
            type: "text",
            text: "{\"title\":\"Draft\",\"summary\":\"\",\"nodes\":[],\"edges\":[]}",
            state: "done",
          },
        ],
      },
      { id: "u2", role: "user", content: "can you write a workflow to generate a github issue and then send the issue to slack" },
    ];

    const uiMessages = normalizeIncomingMessages(rawMessages);
    expect(uiMessages).toHaveLength(3);
    expect(Array.isArray(uiMessages[0].parts)).toBe(true);
    expect(uiMessages[0].parts[0]).toMatchObject({ type: "text", text: "bloop" });

    const modelMessages = await convertToModelMessages(uiMessages);
    expect(modelMessages.length).toBeGreaterThanOrEqual(2);
    expect(modelMessages[0].role).toBe("user");
  });

  it("fills missing/unknown fields with safe defaults", async () => {
    const rawMessages: any[] = [
      { content: "hi (missing role/id)" },
      { role: "assistant", text: "hello (uses text fallback)" },
    ];

    const uiMessages = normalizeIncomingMessages(rawMessages);
    expect(uiMessages[0].role).toBe("user");
    expect(uiMessages[0].id).toBe("msg-0");
    expect(uiMessages[1].parts[0]).toMatchObject({ type: "text", text: "hello (uses text fallback)" });

    await expect(convertToModelMessages(uiMessages)).resolves.toBeDefined();
  });

  it("includes node refinement protocol in the planning prompt", () => {
    const prompt = buildBlueprintPlanningPrompt({ toolsSummary: "- tool.example: Example tool" });
    expect(prompt).toContain("<system_role>");
    expect(prompt).toContain("<workbench_node_refinement>");
    expect(prompt).toContain("NODE REFINEMENT MODE");
  });
});

