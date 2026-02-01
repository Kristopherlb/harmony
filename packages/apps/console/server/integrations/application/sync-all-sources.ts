// server/integrations/application/sync-all-sources.ts
// Use case: Sync events from all configured sources

import type { EventSource } from "@shared/schema";
import type { ServiceClientPort, EventIngestionPort } from "./ports";
import { SyncSource } from "./sync-source";

export interface SyncAllSourcesRequest {
  since?: Date;
  limit?: number;
}

export interface SyncAllSourcesResponse {
  success: boolean;
  results: Record<string, { synced: number; error?: string }>;
}

export class SyncAllSources {
  constructor(
    private serviceClients: ServiceClientPort[],
    private eventIngestion: EventIngestionPort
  ) {}

  async execute(request: SyncAllSourcesRequest): Promise<SyncAllSourcesResponse> {
    const configuredClients = this.serviceClients.filter(c => c.isConfigured());

    if (configuredClients.length === 0) {
      return {
        success: false,
        results: {},
      };
    }

    const results: Record<string, { synced: number; error?: string }> = {};

    for (const client of configuredClients) {
      const syncSource = new SyncSource(client, this.eventIngestion);
      const result = await syncSource.execute({
        source: client.source,
        since: request.since,
        limit: request.limit,
      });
      results[client.source] = {
        synced: result.synced,
        error: result.error,
      };
    }

    return {
      success: true,
      results,
    };
  }
}
