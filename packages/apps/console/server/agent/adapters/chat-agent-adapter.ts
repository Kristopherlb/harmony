// server/agent/adapters/chat-agent-adapter.ts
// Adapter: Adapts AgentService to ChatAgentPort

import type { AgentService } from "../../services/agent-service";
import type { ChatAgentPort } from "../application/ports";
import type { ChatRequest, ChatResponse, AgentTool, Service, DORAMetrics } from "@shared/schema";
import type { Event } from "../../events/domain/types";
import { toSharedEvent } from "../../events/domain/mappers";

export class ChatAgentAdapter implements ChatAgentPort {
  constructor(private agentService: AgentService) {}

  async chat(request: ChatRequest, context: {
    events: Event[];
    services: Service[];
    metrics: DORAMetrics | null;
  }): Promise<ChatResponse> {
    // Convert domain events to shared events for the agent service
    const sharedEvents = context.events.map(toSharedEvent);
    return this.agentService.chat(request, {
      ...context,
      events: sharedEvents,
    });
  }

  getAvailableTools(): AgentTool[] {
    return this.agentService.getAvailableTools();
  }

  getConversation(conversationId: string) {
    return this.agentService.getConversation(conversationId);
  }
}
