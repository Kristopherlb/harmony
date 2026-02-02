// server/events/domain/types.ts
// Domain types for events context - server-internal domain model

export interface Event {
  id: string;
  // Phase 6: canonical incident linkage (IMP-032)
  incidentId?: string;
  timestamp: Date;
  source: "slack" | "jira" | "gitlab" | "bitbucket" | "pagerduty";
  type: "log" | "blocker" | "decision" | "release" | "alert";
  payload: Record<string, unknown>;
  severity: "low" | "medium" | "high" | "critical";
  userId?: string;
  username?: string;
  message: string;
  resolved: boolean;
  resolvedAt?: Date;
  externalLink?: string;
  contextType: "incident" | "support_ticket" | "deployment_failure" | "security_alert" | "infrastructure" | "general";
  serviceTags: string[];
}

export interface Comment {
  id: string;
  eventId: string;
  userId: string;
  username: string;
  content: string;
  createdAt: Date;
}
