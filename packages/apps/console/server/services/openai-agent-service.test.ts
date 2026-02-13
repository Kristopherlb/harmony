import { describe, it, expect } from "vitest";
import { convertToModelMessages } from "ai";
import { buildBlueprintPlanningPrompt } from "../agent/prompts/blueprint-generation";
import {
  buildCatalogGroundedDiscoveryResponse,
  normalizeIncomingMessages,
  summarizeToolsForPrompt,
} from "./openai-agent-service";

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

  it("includes aiHints constraints and negative examples in tool summaries", () => {
    const summary = summarizeToolsForPrompt(
      [
        {
          name: "golden.jira.issue.search",
          description: "Search Jira issues",
          inputSchema: { type: "object", properties: { jql: { type: "string" } }, required: ["jql"] },
          aiHints: {
            usageNotes: "Use bounded JQL for faster responses.",
            constraints: ["JQL must include a project key", "Avoid unbounded date ranges"],
            negativeExamples: ["Do not query all projects without filters"],
          },
        } as any,
      ],
      10
    );

    expect(summary).toContain("constraints:JQL must include a project key");
    expect(summary).toContain("avoid:Do not query all projects without filters");
    expect(summary).toContain("note:Use bounded JQL for faster responses.");
  });

  it("returns explicit no-tools guidance for discovery when catalog is empty", () => {
    const response = buildCatalogGroundedDiscoveryResponse({
      tools: [],
      userQuestion: "What security tools are available?",
    });

    expect(response).toContain("No tools discovered");
    expect(response).toContain("/api/mcp/tools/refresh");
  });

  it("grounds discovery responses in catalog tool ids and avoids workflow generation", () => {
    const response = buildCatalogGroundedDiscoveryResponse({
      tools: [
        {
          name: "golden.security.trivy_scanner",
          description: "Scan container images for vulnerabilities.",
          inputSchema: { type: "object" },
          domain: "security",
          tags: ["security", "scanner"],
        } as any,
      ],
      userQuestion: "What security tools do we have available?",
    });

    expect(response).toContain("golden.security.trivy_scanner");
    expect(response).toContain("Discovery mode only");
    expect(response).not.toContain("proposeWorkflow");
  });

});

