// server/agent/application/ports.ts
// Application ports for agent context

import type { Service, DORAMetrics, ReportStyle, AgentReport, ChatRequest, ChatResponse, AgentTool } from "@shared/schema";
import type { Event } from "../../events/domain/types";
import type { BlueprintDraft } from "../../agent-service";

export interface ReportGenerationPort {
  generateReport(events: Event[], style: ReportStyle): Promise<AgentReport>;
  proposeBlueprint(intent: string): Promise<BlueprintDraft>;
}

export interface ChatAgentPort {
  chat(request: ChatRequest, context: {
    events: Event[];
    services: Service[];
    metrics: DORAMetrics | null;
  }): Promise<ChatResponse>;
  getAvailableTools(): AgentTool[];
  getConversation(conversationId: string): Array<{
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    timestamp: string;
    toolCalls?: Array<{
      tool: string;
      status: "success" | "error" | "pending";
      params?: Record<string, unknown>;
      result?: string;
    }>;
  }>;
}

export interface EventRepositoryPort {
  getEvents(options?: { pageSize?: number }): Promise<{ events: Event[] }>;
}

export interface ServiceCatalogRepositoryPort {
  getServices(): Promise<Service[]>;
}

export interface MetricsPort {
  getDORAMetrics(): Promise<DORAMetrics>;
}
