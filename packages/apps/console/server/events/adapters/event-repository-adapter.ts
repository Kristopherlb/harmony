// server/events/adapters/event-repository-adapter.ts
// Adapter: Adapts IActivityRepository to EventRepositoryPort with domain mapping

import type { IActivityRepository } from "../../storage";
import type { EventRepositoryPort } from "../application/ports";
import type { Event } from "../domain/types";
import { toDomainEvent, toSharedEvent } from "../domain/mappers";

export class EventRepositoryAdapter implements EventRepositoryPort {
  constructor(private repository: IActivityRepository) {}

  async getEvents(options?: { page?: number; pageSize?: number }): Promise<{ events: Event[]; total: number }> {
    const result = await this.repository.getEvents(options);
    return {
      events: result.events.map(toDomainEvent),
      total: result.total,
    };
  }

  async getEventById(id: string): Promise<Event | undefined> {
    const shared = await this.repository.getEventById(id);
    return shared ? toDomainEvent(shared) : undefined;
  }
}
