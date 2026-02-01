// server/integrations/application/ports.ts
// Application ports for integrations context

import type { InsertEvent, EventSource } from "@shared/schema";

export interface EventIngestionPort {
  createEvent(event: InsertEvent): Promise<{ id: string }>;
}

export interface SourceAdapterPort {
  transformToEvent(payload: unknown): InsertEvent;
}

export interface ServiceClientPort {
  source: EventSource;
  isConfigured(): boolean;
  fetchRecentActivity(options?: { since?: Date; limit?: number }): Promise<InsertEvent[]>;
}

export interface WebhookVerificationPort {
  createMiddleware(source: string): (req: any, res: any, next: any) => void;
  getVerificationStatus(): Record<string, boolean>;
}
