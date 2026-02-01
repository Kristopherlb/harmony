// server/events/application/get-activity-stream.ts
// Use case: Get activity stream (paginated events)

import type { Event } from "../domain/types";
import type { EventRepositoryPort } from "./ports";

export interface GetActivityStreamRequest {
  page?: number;
  pageSize?: number;
}

export interface GetActivityStreamResponse {
  events: Event[];
  total: number;
  page: number;
  pageSize: number;
}

export class GetActivityStream {
  constructor(private eventRepository: EventRepositoryPort) {}

  async execute(request: GetActivityStreamRequest): Promise<GetActivityStreamResponse> {
    const page = request.page ?? 1;
    const pageSize = Math.min(request.pageSize ?? 50, 100);

    const { events, total } = await this.eventRepository.getEvents({ page, pageSize });

    return {
      events,
      total,
      page,
      pageSize,
    };
  }
}
