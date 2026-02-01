import type { Event } from "@shared/schema";

export type ReportOption = "team" | "service";

export interface GroupedItems {
  key: string;
  name: string;
  tickets: Event[];
  progress: number;
  riskScore: number;
}

const DONE_STATUSES = ["done", "closed", "resolved", "completed"];

/**
 * Extract issue key from Jira event payload
 */
function extractIssueKey(event: Event): string | undefined {
  if (event.source !== "jira") return undefined;
  
  const payload = event.payload as Record<string, unknown>;
  
  // Try payload.key (from JiraClient)
  if (payload.key && typeof payload.key === "string") {
    return payload.key;
  }
  
  // Try payload.issue.key (from JiraAdapter)
  const issue = payload.issue as Record<string, unknown> | undefined;
  if (issue?.key && typeof issue.key === "string") {
    return issue.key;
  }
  
  // Fallback: extract from message (format: [KEY-123] Summary)
  const match = event.message.match(/([A-Z]+-\d+)/);
  return match ? match[1] : undefined;
}

/**
 * Extract epic key from Jira ticket event
 */
function extractEpicKey(event: Event): string | undefined {
  if (event.source !== "jira") return undefined;
  
  const payload = event.payload as Record<string, unknown>;
  const fields = payload.fields as Record<string, unknown> | undefined;
  
  // Try various epic field formats
  // Epic can be a string key or an object with nested fields
  const epic = fields?.epic;
  if (typeof epic === "string") {
    return epic;
  }
  if (epic && typeof epic === "object") {
    const epicObj = epic as Record<string, unknown>;
    if (epicObj.key && typeof epicObj.key === "string") {
      return epicObj.key;
    }
  }
  
  // Try parent key (for subtasks)
  const parent = fields?.parent as Record<string, unknown> | undefined;
  if (parent?.key && typeof parent.key === "string") {
    return parent.key;
  }
  
  // Try epic custom field
  const epicCustomField = fields?.customfield_10011;
  if (typeof epicCustomField === "string") {
    return epicCustomField;
  }
  
  return undefined;
}

/**
 * Find epic event from allEvents by epic key
 */
function findEpicEvent(epicKey: string, allEvents: Event[]): Event | undefined {
  return allEvents.find((event) => {
    if (event.source !== "jira") return false;
    const issueKey = extractIssueKey(event);
    return issueKey === epicKey;
  });
}

/**
 * Extract team name from Team field (handles both string and object formats)
 */
function extractTeamFromField(fields: Record<string, unknown> | undefined): string | undefined {
  if (!fields) return undefined;
  
  // Try standard Team field (may be string or object)
  const team = fields.Team || fields.team;
  
  if (typeof team === "string" && team.trim()) {
    return team.trim();
  }
  
  if (team && typeof team === "object") {
    const teamObj = team as Record<string, unknown>;
    // Try name property
    if (teamObj.name && typeof teamObj.name === "string") {
      return teamObj.name.trim();
    }
    // Try value property
    if (teamObj.value && typeof teamObj.value === "string") {
      return teamObj.value.trim();
    }
  }
  
  return undefined;
}

/**
 * Extract team name from Jira event
 * Hierarchy:
 * 1. Ticket Team field
 * 2. Epic Team field (if ticket doesn't have Team)
 * 3. Epic assignee (if epic doesn't have Team)
 * 4. Service/Component (final fallback)
 */
function extractTeam(event: Event, allEvents: Event[]): string {
  if (event.source !== "jira") {
    return extractService(event);
  }
  
  const payload = event.payload as Record<string, unknown>;
  const fields = payload.fields as Record<string, unknown> | undefined;
  
  // 1. Check ticket Team field first
  const ticketTeam = extractTeamFromField(fields);
  if (ticketTeam) {
    return ticketTeam;
  }
  
  // 2. Get epic key from ticket
  const epicKey = extractEpicKey(event);
  if (!epicKey) {
    // No epic, fall back to service
    return extractService(event);
  }
  
  // 3. Find epic event in allEvents
  const epicEvent = findEpicEvent(epicKey, allEvents);
  if (!epicEvent) {
    // Epic not found in events, fall back to service
    return extractService(event);
  }
  
  // 4. Check epic Team field
  const epicPayload = epicEvent.payload as Record<string, unknown>;
  const epicFields = epicPayload.fields as Record<string, unknown> | undefined;
  const epicTeam = extractTeamFromField(epicFields);
  if (epicTeam) {
    return epicTeam;
  }
  
  // 5. Check epic assignee
  const epicAssignee = epicFields?.assignee as Record<string, unknown> | undefined;
  const epicAssigneeName = epicAssignee?.displayName as string | undefined;
  if (epicAssigneeName) {
    return epicAssigneeName;
  }
  
  // 6. Final fallback: use service/component
  return extractService(event);
}

/**
 * Extract service name from Jira event
 * Uses components, serviceTags, or custom field
 */
function extractService(event: Event): string {
  // First try serviceTags from event
  if (event.serviceTags && event.serviceTags.length > 0) {
    return event.serviceTags[0];
  }
  
  if (event.source !== "jira") return "Other";
  
  const payload = event.payload as Record<string, unknown>;
  const fields = payload.fields as Record<string, unknown> | undefined;
  
  // Try components field (array of component objects)
  const components = fields?.components as Array<Record<string, unknown>> | undefined;
  if (components && components.length > 0) {
    const componentName = components[0].name as string | undefined;
    if (componentName) return componentName;
  }
  
  // Try service custom field
  const serviceField = 
    (fields?.customfield_10022 as string) || // Service field
    (fields?.customfield_10023 as string) || // Alternative service field
    (fields?.service as string) ||
    (payload.service as string);
  
  if (serviceField) {
    return serviceField;
  }
  
  // Try to extract from project key or summary
  const projectKey = (fields?.project as Record<string, unknown>)?.key as string | undefined;
  if (projectKey) {
    return projectKey;
  }
  
  return "Other";
}

/**
 * Calculate group completion percentage
 */
function calculateGroupProgress(tickets: Event[]): number {
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
 * Calculate group risk score (0-100, higher = more risk)
 */
function calculateGroupRiskScore(tickets: Event[], now: Date): number {
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
 * Organize Jira events by team
 */
export function organizeByTeam(events: Event[], allEvents: Event[] = events): GroupedItems[] {
  const teamMap = new Map<string, Event[]>();

  events.forEach((event) => {
    if (event.source !== "jira") return;

    const team = extractTeam(event, allEvents);
    
    if (!teamMap.has(team)) {
      teamMap.set(team, []);
    }
    teamMap.get(team)!.push(event);
  });

  const now = new Date();
  return Array.from(teamMap.entries()).map(([team, tickets]) => {
    const progress = calculateGroupProgress(tickets);
    const riskScore = calculateGroupRiskScore(tickets, now);

    return {
      key: team,
      name: team,
      tickets,
      progress,
      riskScore,
    };
  });
}

/**
 * Organize Jira events by service
 */
export function organizeByService(events: Event[]): GroupedItems[] {
  const serviceMap = new Map<string, Event[]>();

  events.forEach((event) => {
    if (event.source !== "jira") return;

    const service = extractService(event);
    
    if (!serviceMap.has(service)) {
      serviceMap.set(service, []);
    }
    serviceMap.get(service)!.push(event);
  });

  const now = new Date();
  return Array.from(serviceMap.entries()).map(([service, tickets]) => {
    const progress = calculateGroupProgress(tickets);
    const riskScore = calculateGroupRiskScore(tickets, now);

    return {
      key: service,
      name: service,
      tickets,
      progress,
      riskScore,
    };
  });
}

/**
 * Sort grouped items by risk score (highest first), then by name
 */
export function sortGroupedItems(groups: GroupedItems[]): GroupedItems[] {
  return [...groups].sort((a, b) => {
    // First sort by risk score (descending)
    if (b.riskScore !== a.riskScore) {
      return b.riskScore - a.riskScore;
    }
    // Then by name (ascending)
    return a.name.localeCompare(b.name);
  });
}
