// server/events/application/ports.ts
// Application ports (interfaces) for events context

import type { Event } from "../domain/types";

export interface EventRepositoryPort {
  getEvents(options?: { page?: number; pageSize?: number }): Promise<{ events: Event[]; total: number }>;
  getEventById(id: string): Promise<Event | undefined>;
}
