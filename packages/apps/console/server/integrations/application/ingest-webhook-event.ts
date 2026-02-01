// server/integrations/application/ingest-webhook-event.ts
// Use case: Ingest webhook event from external source

import type { InsertEvent, EventSource } from "@shared/schema";
import type { SourceAdapterPort, EventIngestionPort } from "./ports";

export interface IngestWebhookEventRequest {
  source: EventSource;
  payload: unknown;
}

export interface IngestWebhookEventResponse {
  eventId: string;
  success: boolean;
}

export class IngestWebhookEvent {
  constructor(
    private adapter: SourceAdapterPort,
    private eventIngestion: EventIngestionPort
  ) {}

  async execute(request: IngestWebhookEventRequest): Promise<IngestWebhookEventResponse> {
    const insertEvent = this.adapter.transformToEvent(request.payload);
    const result = await this.eventIngestion.createEvent(insertEvent);
    return {
      eventId: result.id,
      success: true,
    };
  }
}
