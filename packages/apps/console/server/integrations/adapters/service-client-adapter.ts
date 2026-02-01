// server/integrations/adapters/service-client-adapter.ts
// Adapter: Adapts ServiceClient to ServiceClientPort

import type { ServiceClient } from "../../clients";
import type { ServiceClientPort } from "../application/ports";
import type { EventSource, InsertEvent } from "@shared/schema";

export class ServiceClientAdapter implements ServiceClientPort {
  source: EventSource;

  constructor(private client: ServiceClient, source: EventSource) {
    this.source = source;
  }

  isConfigured(): boolean {
    return this.client.isConfigured();
  }

  async fetchRecentActivity(options?: { since?: Date; limit?: number }): Promise<InsertEvent[]> {
    return this.client.fetchRecentActivity(options);
  }
}
