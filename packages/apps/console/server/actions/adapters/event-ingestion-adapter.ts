// server/actions/adapters/event-ingestion-adapter.ts
// Adapter: Adapts repository.createEvent to EventIngestionPort

import type { IActivityRepository } from "../../storage";
import type { EventIngestionPort } from "../application/ports";
import type { InsertEvent } from "@shared/schema";

export class EventIngestionAdapter implements EventIngestionPort {
  constructor(private repository: IActivityRepository) {}

  async createEvent(event: {
    timestamp: string;
    source: string;
    type: string;
    payload: Record<string, unknown>;
    severity: string;
    userId: string;
    username: string;
    message: string;
    resolved: boolean;
    contextType: string;
    serviceTags: string[];
  }): Promise<{ id: string }> {
    const insertEvent: InsertEvent = {
      timestamp: event.timestamp,
      source: event.source as any,
      type: event.type as any,
      payload: event.payload,
      severity: event.severity as any,
      userId: event.userId,
      username: event.username,
      message: event.message,
      resolved: event.resolved,
      contextType: event.contextType as any,
      serviceTags: event.serviceTags,
    };

    const created = await this.repository.createEvent(insertEvent);
    return { id: created.id };
  }
}
