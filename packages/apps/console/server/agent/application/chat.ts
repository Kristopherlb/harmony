// server/agent/application/chat.ts
// Use case: Chat with agent

import type { ChatRequest, ChatResponse } from "@shared/schema";
import type { ChatAgentPort, EventRepositoryPort, ServiceCatalogRepositoryPort, MetricsPort } from "./ports";
import type { Event } from "../../events/domain/types";

export interface ChatRequestUseCase {
  request: ChatRequest;
}

export class Chat {
  constructor(
    private chatAgent: ChatAgentPort,
    private eventRepository: EventRepositoryPort,
    private serviceCatalogRepository: ServiceCatalogRepositoryPort,
    private metricsPort: MetricsPort
  ) {}

  async execute(useCaseRequest: ChatRequestUseCase): Promise<ChatResponse> {
    const { events } = await this.eventRepository.getEvents();
    const services = await this.serviceCatalogRepository.getServices();
    
    let metrics = null;
    try {
      metrics = await this.metricsPort.getDORAMetrics();
    } catch (error) {
      // Metrics may not be available, continue without them
      console.warn("Failed to fetch metrics for chat context:", error);
    }

    const context = { events, services, metrics };
    return this.chatAgent.chat(useCaseRequest.request, context);
  }
}
