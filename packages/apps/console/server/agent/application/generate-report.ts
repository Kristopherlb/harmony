// server/agent/application/generate-report.ts
// Use case: Generate agent report

import type { ReportStyle } from "@shared/schema";
import type { ReportGenerationPort, EventRepositoryPort } from "./ports";
import type { Event } from "../../events/domain/types";

export interface GenerateReportRequest {
  style: ReportStyle;
  days?: number;
  sources?: string[];
}

export interface GenerateReportResponse {
  id: string;
  style: ReportStyle;
  content: string;
  generatedAt: string;
  eventCount: number;
  timeRangeDays: number;
}

export class GenerateReport {
  constructor(
    private reportGeneration: ReportGenerationPort,
    private eventRepository: EventRepositoryPort
  ) {}

  async execute(request: GenerateReportRequest): Promise<GenerateReportResponse> {
    const { events } = await this.eventRepository.getEvents({ pageSize: 500 });
    
    const days = request.days ?? 7;
    const since = new Date();
    since.setDate(since.getDate() - days);

    let filteredEvents = events.filter(e => e.timestamp >= since);
    
    if (request.sources && request.sources.length > 0) {
      filteredEvents = filteredEvents.filter(e => request.sources!.includes(e.source));
    }

    const report = await this.reportGeneration.generateReport(filteredEvents, request.style);
    
    return report;
  }
}
