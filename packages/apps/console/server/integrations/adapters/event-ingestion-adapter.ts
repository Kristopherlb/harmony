// server/integrations/adapters/event-ingestion-adapter.ts
// Adapter: Adapts IActivityRepository to EventIngestionPort

import type { IActivityRepository } from "../../storage";
import type { EventIngestionPort } from "../application/ports";
import type { InsertEvent } from "@shared/schema";

export class EventIngestionAdapter implements EventIngestionPort {
  constructor(private repository: IActivityRepository) {}

  async createEvent(event: InsertEvent): Promise<{ id: string }> {
    const created = await this.repository.createEvent(event);
    return { id: created.id };
  }
}
