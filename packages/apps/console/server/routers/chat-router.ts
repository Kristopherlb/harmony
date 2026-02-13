import { Router } from "express";
import { createUIMessageStream, pipeUIMessageStreamToResponse } from "ai";
import type { HarmonyMcpToolService } from "../agent/services/harmony-mcp-tool-service";

function createFixtureChatStream(input: { fixtureId: string }) {
  const draft = {
    title: "Fixture workflow",
    summary: "Deterministic fixture draft for Tier-0 E2E.",
    nodes: [
      { id: "n1", label: "Start", type: "start" },
      { id: "n2", label: "Log", type: "log", properties: { message: "hello" } },
      { id: "n3", label: "Sleep", type: "sleep", properties: { seconds: 1 } },
    ],
    edges: [
      { source: "n1", target: "n2" },
      { source: "n2", target: "n3" },
    ],
  };

  // Minimal UI stream: a single assistant message that contains the draft JSON.
  // The Workbench client has a JSON-text fallback parser (and tests can assert
  // on stable text) without requiring tool-part streaming.
  const text = JSON.stringify(
    {
      ...draft,
      fixtureId: input.fixtureId,
    },
    null,
    2
  );

  return createUIMessageStream({
    execute: ({ writer }) => {
      writer.write({ type: "start" } as any);
      writer.write({ type: "text-start", id: "fixture-text" } as any);
      writer.write({ type: "text-delta", id: "fixture-text", delta: text } as any);
      writer.write({ type: "text-end", id: "fixture-text" } as any);
      writer.write({ type: "finish", finishReason: "stop" } as any);
    },
  });
}

export function createChatRouter(deps: { mcpToolService: HarmonyMcpToolService }) {
  const router = Router();

  router.post("/chat", async (req: any, res: any) => {
    try {
      const { messages, currentDraft, activeWorkflowId, budgetKeyOverride } = req.body ?? {};

      const fixtureId = process.env.HARMONY_CHAT_FIXTURE;
      if (typeof fixtureId === "string" && fixtureId.length > 0) {
        const stream = createFixtureChatStream({ fixtureId });
        pipeUIMessageStreamToResponse({ response: res, stream });
        return;
      }

      const tools = deps.mcpToolService.listTools();

      const override =
        typeof budgetKeyOverride === "string" && budgetKeyOverride.trim().length > 0
          ? budgetKeyOverride.trim().slice(0, 200)
          : null;
      const budgetKey =
        override ??
        (typeof req?.user?.id === "string"
          ? `user:${req.user.id}`
          : typeof req?.sessionID === "string"
            ? `session:${req.sessionID}`
            : "session:anonymous");

      const [{ OpenAIAgentService }, { getTemplateSummaries }] = await Promise.all([
        import("../services/openai-agent-service"),
        import("../services/template-catalog"),
      ]);
      const templatesSummary = await getTemplateSummaries();

      const stream = await OpenAIAgentService.generateBlueprint({
        messages,
        tools,
        budgetKey,
        currentDraft: currentDraft ?? null,
        templatesSummary,
        activeWorkflowId:
          typeof activeWorkflowId === "string" && activeWorkflowId.length > 0
            ? activeWorkflowId
            : undefined,
      });
      pipeUIMessageStreamToResponse({ response: res, stream });
    } catch (error) {
      console.error("Chat API Error:", error);
      res.status(500).json({ error: "Failed to process chat request" });
    }
  });

  return router;
}
