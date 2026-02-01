import type { Event } from "@shared/schema";

export interface EpicData {
  epicKey: string;
  epicName: string;
  tickets: Event[];
  releaseDate: Date;
  progress: number;
  riskScore: number;
}

const DONE_STATUSES = ["done", "closed", "resolved", "completed"];

/**
 * Organize Jira events by epic
 */
export function organizeEpics(events: Event[]): EpicData[] {
  const epicMap = new Map<string, Event[]>();

  events.forEach((event) => {
    if (event.source !== "jira") return;

    const payload = event.payload as Record<string, unknown>;
    const fields = payload.fields as Record<string, unknown> | undefined;
    
    // Try to get epic from various possible fields
    const epicKey = 
      (fields?.epic as string) ||
      (fields?.parent as Record<string, unknown>)?.key as string ||
      (fields?.customfield_10011 as string) || // Common Jira epic field
      "No Epic";
    
    const epicName = 
      (fields?.epic as Record<string, unknown>)?.name as string ||
      (fields?.parent as Record<string, unknown>)?.summary as string ||
      epicKey;

    if (!epicMap.has(epicKey)) {
      epicMap.set(epicKey, []);
    }
    epicMap.get(epicKey)!.push(event);
  });

  const now = new Date();
  return Array.from(epicMap.entries()).map(([epicKey, tickets]) => {
    const firstTicket = tickets[0];
    const payload = firstTicket.payload as Record<string, unknown>;
    const fields = payload.fields as Record<string, unknown> | undefined;
    
    // Extract release date from epic or first ticket
    const releaseDateStr = 
      (fields?.customfield_10020 as string) || // Release date field
      (fields?.duedate as string) ||
      firstTicket.timestamp;
    const releaseDate = new Date(releaseDateStr);

    const epicName = 
      (fields?.epic as Record<string, unknown>)?.name as string ||
      (fields?.parent as Record<string, unknown>)?.summary as string ||
      epicKey;

    const progress = calculateEpicProgress(tickets);
    const riskScore = calculateEpicRiskScore(tickets, now);

    return {
      epicKey,
      epicName,
      tickets,
      releaseDate,
      progress,
      riskScore,
    };
  });
}

/**
 * Calculate epic completion percentage
 */
export function calculateEpicProgress(tickets: Event[]): number {
  if (tickets.length === 0) return 100;

  const doneCount = tickets.filter((ticket) => {
    const payload = ticket.payload as Record<string, unknown>;
    const fields = payload.fields as Record<string, unknown> | undefined;
    const status = fields?.status as Record<string, unknown> | undefined;
    const statusName = ((status?.name as string) || "").toLowerCase();
    return DONE_STATUSES.some((done) => statusName.includes(done));
  }).length;

  return Math.round((doneCount / tickets.length) * 100);
}

/**
 * Calculate epic risk score (0-100, higher = more risk)
 */
export function calculateEpicRiskScore(tickets: Event[], now: Date): number {
  if (tickets.length === 0) return 0;

  let riskScore = 0;
  const openTickets = tickets.filter((ticket) => {
    const payload = ticket.payload as Record<string, unknown>;
    const fields = payload.fields as Record<string, unknown> | undefined;
    const status = fields?.status as Record<string, unknown> | undefined;
    const statusName = ((status?.name as string) || "").toLowerCase();
    return !DONE_STATUSES.some((done) => statusName.includes(done));
  });

  // Base risk from open ticket count (max 40 points)
  const openRatio = openTickets.length / tickets.length;
  riskScore += openRatio * 40;

  // Add risk from high severity tickets (max 30 points)
  const criticalCount = openTickets.filter((t) => t.severity === "critical").length;
  const highCount = openTickets.filter((t) => t.severity === "high").length;
  riskScore += (criticalCount * 15) + (highCount * 5);
  riskScore = Math.min(riskScore, 30); // Cap at 30

  // Add risk from blockers (max 20 points)
  const blockerCount = openTickets.filter((t) => t.type === "blocker").length;
  riskScore += Math.min(blockerCount * 10, 20);

  // Add risk from stale tickets (max 10 points)
  const staleCount = openTickets.filter((ticket) => {
    const ticketDate = new Date(ticket.timestamp);
    const daysSinceUpdate = (now.getTime() - ticketDate.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceUpdate > 7;
  }).length;
  riskScore += Math.min(staleCount * 2, 10);

  return Math.min(Math.round(riskScore), 100);
}

/**
 * Sort epics by risk score (highest first), then by release date (earliest first)
 */
export function sortEpics(epics: EpicData[]): EpicData[] {
  return [...epics].sort((a, b) => {
    // First sort by risk score (descending)
    if (b.riskScore !== a.riskScore) {
      return b.riskScore - a.riskScore;
    }
    // Then by release date (ascending - earlier dates first)
    return a.releaseDate.getTime() - b.releaseDate.getTime();
  });
}
