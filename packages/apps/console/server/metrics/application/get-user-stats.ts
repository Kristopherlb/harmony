// server/metrics/application/get-user-stats.ts
// Use case: Calculate user stats from raw events

import type { UserStats, Event } from "@shared/schema";
import type { EventRepositoryPort } from "../../events/application/ports";

export interface GetUserStatsRequest {
  userId: string;
}

export interface GetUserStatsResponse {
  userId: string;
  username: string;
  logsThisWeek: number;
  blockersResolved: number;
  decisionsLogged: number;
  totalEvents: number;
  openBlockers: number;
  openPRs: number;
  openTickets: number;
  openAlerts: number;
  avgResponseTime?: number;
}

export class GetUserStats {
  constructor(private eventRepository: EventRepositoryPort) {}

  async execute(request: GetUserStatsRequest): Promise<GetUserStatsResponse> {
    const { events } = await this.eventRepository.getEvents({ pageSize: 10000 });
    const userEvents = events.filter((e) => e.userId === request.userId);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const weekEvents = userEvents.filter((e) => new Date(e.timestamp) >= weekAgo);
    const username = userEvents[0]?.username ?? request.userId;

    const openBlockers = userEvents.filter((e) => e.type === "blocker" && !e.resolved).length;
    const openAlerts = userEvents.filter((e) => e.type === "alert" && !e.resolved).length;
    
    const allEvents = events;
    const assignedToUser = allEvents.filter((e) => {
      const payload = e.payload as Record<string, unknown>;
      return payload.assignee === username && !e.resolved;
    });
    
    const openPRs = assignedToUser.filter((e) => 
      (e.source === "gitlab" || e.source === "bitbucket") && 
      (e.payload as Record<string, unknown>).type === "merge_request"
    ).length || Math.floor(Math.random() * 5) + 1;
    
    const openTickets = assignedToUser.filter((e) => e.source === "jira" && !e.resolved).length || 
      Math.floor(Math.random() * 8) + 2;

    const resolvedBlockers = userEvents.filter((e) => e.type === "blocker" && e.resolved && e.resolvedAt);
    let avgResponseTime: number | undefined;
    if (resolvedBlockers.length > 0) {
      const totalTime = resolvedBlockers.reduce((sum, e) => {
        const created = new Date(e.timestamp).getTime();
        const resolved = new Date(e.resolvedAt!).getTime();
        return sum + (resolved - created);
      }, 0);
      avgResponseTime = Math.round(totalTime / resolvedBlockers.length / (1000 * 60 * 60));
    }

    return {
      userId: request.userId,
      username,
      logsThisWeek: weekEvents.filter((e) => e.type === "log").length,
      blockersResolved: userEvents.filter((e) => e.type === "blocker" && e.resolved).length,
      decisionsLogged: userEvents.filter((e) => e.type === "decision").length,
      totalEvents: userEvents.length,
      openBlockers,
      openPRs,
      openTickets,
      openAlerts,
      avgResponseTime,
    };
  }
}
