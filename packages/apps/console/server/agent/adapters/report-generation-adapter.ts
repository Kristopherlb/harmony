// server/agent/adapters/report-generation-adapter.ts
// Adapter: Adapts IAgentService to ReportGenerationPort

import type { IAgentService, BlueprintDraft } from "../../agent-service";
import type { ReportGenerationPort } from "../application/ports";
import type { ReportStyle, AgentReport } from "@shared/schema";
import type { Event } from "../../events/domain/types";
import { toSharedEvent } from "../../events/domain/mappers";

export class ReportGenerationAdapter implements ReportGenerationPort {
  constructor(private agentService: IAgentService) { }

  async generateReport(events: Event[], style: ReportStyle): Promise<AgentReport> {
    // Convert domain events to shared events for the agent service
    const sharedEvents = events.map(toSharedEvent);
    return this.agentService.generateReport(sharedEvents, style);
  }

  async proposeBlueprint(intent: string): Promise<BlueprintDraft> {
    return this.agentService.proposeBlueprint(intent);
  }
}
