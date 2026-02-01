import { Router } from "express";
import { pipeUIMessageStreamToResponse } from "ai";
import { OpenAIAgentService } from "../services/openai-agent-service";
import type { HarmonyMcpToolService } from "../agent/services/harmony-mcp-tool-service";

export function createChatRouter(deps: { mcpToolService: HarmonyMcpToolService }) {
  const router = Router();

  router.post("/chat", async (req: any, res: any) => {
    try {
      const { messages } = req.body;
      const tools = deps.mcpToolService.listTools();

      const stream = await OpenAIAgentService.generateBlueprint({ messages, tools });
      pipeUIMessageStreamToResponse({ response: res, stream });
    } catch (error) {
      console.error("Chat API Error:", error);
      res.status(500).json({ error: "Failed to process chat request" });
    }
  });

  return router;
}
