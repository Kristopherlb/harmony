// server/integrations/application/sync-source.ts
// Use case: Sync events from external source

import type { InsertEvent, EventSource } from "@shared/schema";
import type { ServiceClientPort, EventIngestionPort } from "./ports";

export interface SyncSourceRequest {
  source: EventSource;
  since?: Date;
  limit?: number;
}

export interface SyncSourceResponse {
  source: EventSource;
  synced: number;
  events: Array<{ id: string; message: string }>;
  error?: string;
}

export class SyncSource {
  constructor(
    private serviceClient: ServiceClientPort,
    private eventIngestion: EventIngestionPort
  ) {}

  async execute(request: SyncSourceRequest): Promise<SyncSourceResponse> {
    if (!this.serviceClient.isConfigured()) {
      return {
        source: request.source,
        synced: 0,
        events: [],
        error: `${request.source} is not configured`,
      };
    }

    try {
      const insertEvents = await this.serviceClient.fetchRecentActivity({
        since: request.since,
        limit: request.limit ?? 50,
      });

      const events = [];
      for (const insertEvent of insertEvents) {
        const result = await this.eventIngestion.createEvent(insertEvent);
        events.push({
          id: result.id,
          message: insertEvent.message,
        });
      }

      return {
        source: request.source,
        synced: events.length,
        events,
      };
    } catch (error) {
      return {
        source: request.source,
        synced: 0,
        events: [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
