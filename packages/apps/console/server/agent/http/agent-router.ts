// server/agent/http/agent-router.ts
// HTTP router for agent context - consolidates report generation + chat/LLM

import type { Request, Response } from "express";
import { Router as createRouter, type Router } from "express";
import { ReportRequestSchema, ChatRequestSchema } from "@shared/schema";
import { GenerateReport } from "../application/generate-report";
import { Chat } from "../application/chat";
import type {
  ReportGenerationPort,
  ChatAgentPort,
  EventRepositoryPort,
  ServiceCatalogRepositoryPort,
  MetricsPort,
} from "../application/ports";

export interface AgentRouterDeps {
  reportGeneration: ReportGenerationPort;
  chatAgent: ChatAgentPort;
  eventRepository: EventRepositoryPort;
  serviceCatalogRepository: ServiceCatalogRepositoryPort;
  metricsPort: MetricsPort;
}

export function createAgentRouter(deps: AgentRouterDeps): Router {
  const router = createRouter();

  const generateReport = new GenerateReport(deps.reportGeneration, deps.eventRepository);
  const chat = new Chat(
    deps.chatAgent,
    deps.eventRepository,
    deps.serviceCatalogRepository,
    deps.metricsPort
  );

  // POST /api/agent/generate-report
  router.post("/generate-report", async (req: Request, res: Response) => {
    try {
      const parseResult = ReportRequestSchema.safeParse(req.body);

      if (!parseResult.success) {
        return res.status(400).json({
          error: "Invalid report request",
          details: parseResult.error.flatten(),
        });
      }

      const report = await generateReport.execute(parseResult.data);
      return res.json(report);
    } catch (error) {
      console.error("Error generating report:", error);
      return res.status(500).json({ error: "Failed to generate report" });
    }
  });

  // POST /api/agent/chat
  router.post("/chat", async (req: Request, res: Response) => {
    try {
      const parseResult = ChatRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: "Invalid chat request",
          details: parseResult.error.flatten(),
        });
      }

      const response = await chat.execute({ request: parseResult.data });
      return res.json(response);
    } catch (error) {
      console.error("Error in agent chat:", error);
      return res.status(500).json({ error: "Failed to process chat" });
    }
  });

  // GET /api/agent/tools
  router.get("/tools", async (_req: Request, res: Response) => {
    try {
      const tools = deps.chatAgent.getAvailableTools();
      return res.json({ tools });
    } catch (error) {
      console.error("Error fetching agent tools:", error);
      return res.status(500).json({ error: "Failed to fetch agent tools" });
    }
  });

  // GET /api/agent/conversation/:id
  router.get("/conversation/:id", async (req: Request, res: Response) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const messages = deps.chatAgent.getConversation(id);
      return res.json({ messages, conversationId: id });
    } catch (error) {
      console.error("Error fetching conversation:", error);
      return res.status(500).json({ error: "Failed to fetch conversation" });
    }
  });

  // POST /api/agent/blueprint/propose
  router.post("/blueprint/propose", async (req: Request, res: Response) => {
    try {
      const { intent } = req.body;
      if (!intent || typeof intent !== "string") {
        return res.status(400).json({ error: "Intent is required" });
      }

      // We'll use the chat agent service directly for now, or just the agent service mock
      // Ideally this goes through the 'Chat' application service if it strictly involves conversation history
      // But for the 'propose' action, we can call the service directly
      const draft = await deps.reportGeneration.proposeBlueprint(intent);
      // Note: we're using 'reportGeneration' port here which maps to IAgentService
      // We should probably rename 'reportGeneration' dependency to 'agentService' to be more generic
      // but to minimize refactoring now, we'll cast or just allow it if the interface matches.
      // Actually, let's fix the cast in the router creation if needed.

      return res.json(draft);
    } catch (error) {
      console.error("Error proposing blueprint:", error);
      return res.status(500).json({ error: "Failed to propose blueprint" });
    }
  });

  return router;
}
