import { pgTable, uuid, timestamp, text, boolean, jsonb, varchar, integer, real, pgEnum, index, unique } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/**
 * Drizzle ORM table definitions for PostgreSQL.
 * This file contains the database schema separate from the Zod API schemas.
 */

// Enums
export const eventSourceEnum = pgEnum("event_source", [
  "slack",
  "jira",
  "gitlab",
  "bitbucket",
  "pagerduty",
  "circleci",
]);

export const eventTypeEnum = pgEnum("event_type", [
  "log",
  "blocker",
  "decision",
  "release",
  "alert",
]);

export const severityEnum = pgEnum("severity", [
  "low",
  "medium",
  "high",
  "critical",
]);

export const contextTypeEnum = pgEnum("context_type", [
  "incident",
  "support_ticket",
  "deployment_failure",
  "security_alert",
  "infrastructure",
  "general",
]);

export const serviceTypeEnum = pgEnum("service_type", [
  "api",
  "worker",
  "database",
  "cache",
  "gateway",
  "frontend",
  "ml",
  "storage",
]);

export const serviceTierEnum = pgEnum("service_tier", [
  "tier1",
  "tier2",
  "tier3",
]);

export const serviceHealthEnum = pgEnum("service_health", [
  "healthy",
  "degraded",
  "critical",
  "unknown",
]);

// Events table
export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
  source: eventSourceEnum("source").notNull(),
  type: eventTypeEnum("type").notNull(),
  severity: severityEnum("severity").notNull(),
  message: text("message").notNull(),
  payload: jsonb("payload").notNull().default({}),
  userId: varchar("user_id", { length: 255 }),
  username: varchar("username", { length: 255 }),
  resolved: boolean("resolved").notNull().default(false),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  externalLink: text("external_link"),
  contextType: contextTypeEnum("context_type").notNull().default("general"),
  serviceTags: jsonb("service_tags").notNull().default([]), // Array of strings stored as JSONB
}, (table) => ({
  timestampIdx: index("events_timestamp_idx").on(table.timestamp.desc()),
  sourceIdx: index("events_source_idx").on(table.source),
  typeIdx: index("events_type_idx").on(table.type),
  userIdIdx: index("events_user_id_idx").on(table.userId),
  resolvedIdx: index("events_resolved_idx").on(table.resolved),
}));

// Comments table
export const comments = pgTable("comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  userId: varchar("user_id", { length: 255 }).notNull(),
  username: varchar("username", { length: 255 }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  parentId: uuid("parent_id"), // For nested/threaded comments
}, (table) => ({
  eventIdIdx: index("comments_event_id_idx").on(table.eventId),
  createdAtIdx: index("comments_created_at_idx").on(table.createdAt),
  parentIdIdx: index("comments_parent_id_idx").on(table.parentId),
}));

// Teams table (must exist before services due to foreign key)
export const teams = pgTable("teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  lead: varchar("lead", { length: 255 }).notNull(),
  slackChannel: varchar("slack_channel", { length: 255 }),
  oncallRotation: varchar("oncall_rotation", { length: 255 }),
}, (table) => ({
  slugIdx: index("teams_slug_idx").on(table.slug),
}));

// Services table
export const services = pgTable("services", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description").notNull(),
  type: serviceTypeEnum("type").notNull(),
  tier: serviceTierEnum("tier").notNull(),
  health: serviceHealthEnum("health").notNull(),
  teamId: uuid("team_id").notNull().references(() => teams.id, { onDelete: "restrict" }),
  repositoryUrl: text("repository_url"),
  documentationUrl: text("documentation_url"),
  dashboardUrl: text("dashboard_url"),
  dependencies: jsonb("dependencies").notNull().default([]), // Array of service IDs
  tags: jsonb("tags").notNull().default([]), // Array of strings
  language: varchar("language", { length: 100 }),
  lastDeployedAt: timestamp("last_deployed_at", { withTimezone: true }),
  version: varchar("version", { length: 100 }),
  errorRate: real("error_rate"),
  latencyP50: integer("latency_p50"), // milliseconds
  latencyP99: integer("latency_p99"), // milliseconds
  requestsPerSecond: real("requests_per_second"),
  cpuUsage: real("cpu_usage"), // percentage
  memoryUsage: real("memory_usage"), // percentage
  openIncidents: integer("open_incidents").notNull().default(0),
  openVulnerabilities: integer("open_vulnerabilities").notNull().default(0),
  monthlyCost: real("monthly_cost"),
}, (table) => ({
  teamIdIdx: index("services_team_id_idx").on(table.teamId),
  typeIdx: index("services_type_idx").on(table.type),
  healthIdx: index("services_health_idx").on(table.health),
  tierIdx: index("services_tier_idx").on(table.tier),
}));

// Relations (for Drizzle relational queries - optional but useful)
export const eventsRelations = relations(events, ({ many }) => ({
  comments: many(comments),
}));

export const commentsRelations = relations(comments, ({ one, many }) => ({
  event: one(events, {
    fields: [comments.eventId],
    references: [events.id],
  }),
  parent: one(comments, {
    fields: [comments.parentId],
    references: [comments.id],
    relationName: "parent",
  }),
  replies: many(comments, {
    relationName: "parent",
  }),
}));

export const teamsRelations = relations(teams, ({ many }) => ({
  services: many(services),
}));

export const servicesRelations = relations(services, ({ one }) => ({
  team: one(teams, {
    fields: [services.teamId],
    references: [teams.id],
  }),
}));

// CircleCI Job Metrics table
// Aggregated job metrics from CircleCI Insights API (for reference/metrics, not deployment counting)
export const circleciJobMetrics = pgTable("circleci_job_metrics", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectSlug: varchar("project_slug", { length: 255 }).notNull(),
  workflowName: varchar("workflow_name", { length: 255 }).notNull(),
  jobName: varchar("job_name", { length: 255 }).notNull(),
  jobPrefix: varchar("job_prefix", { length: 50 }), // "app", "eu-central", "oc", "us2", "ca"
  serviceStackName: varchar("service_stack_name", { length: 255 }), // "TicketingWebBackendServiceStack" - extracted from job name for grouping
  reportingWindow: varchar("reporting_window", { length: 50 }).notNull(), // "last-90-days", "last-30-days"
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  windowEnd: timestamp("window_end", { withTimezone: true }).notNull(),
  
  // Aggregated metrics from Insights API
  totalRuns: integer("total_runs").notNull(),
  successfulRuns: integer("successful_runs").notNull(),
  failedRuns: integer("failed_runs").notNull(),
  successRate: real("success_rate").notNull(),
  throughput: real("throughput").notNull(), // Average runs per day
  totalCreditsUsed: integer("total_credits_used"),
  durationMetrics: jsonb("duration_metrics").notNull().default({}), // {min, mean, median, p95, max, standard_deviation}
  
  // Metadata
  syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  projectWorkflowIdx: index("circleci_job_metrics_project_workflow_idx").on(table.projectSlug, table.workflowName),
  jobPrefixIdx: index("circleci_job_metrics_prefix_idx").on(table.jobPrefix),
  serviceStackIdx: index("circleci_job_metrics_service_stack_idx").on(table.serviceStackName),
  windowIdx: index("circleci_job_metrics_window_idx").on(table.windowStart, table.windowEnd),
  uniqueJobMetric: unique("circleci_job_metrics_unique_idx").on(
    table.projectSlug, 
    table.workflowName, 
    table.jobName, 
    table.reportingWindow,
    table.windowStart
  ),
}));

// Individual job runs from CircleCI pipeline/workflow API (for deployment frequency calculation)
// This stores actual job runs with release info, so we can group by releaseKey + serviceStackName
export const circleciJobRuns = pgTable("circleci_job_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectSlug: varchar("project_slug", { length: 255 }).notNull(),
  pipelineId: varchar("pipeline_id", { length: 255 }).notNull(),
  pipelineNumber: integer("pipeline_number"),
  workflowId: varchar("workflow_id", { length: 255 }).notNull(),
  workflowName: varchar("workflow_name", { length: 255 }).notNull(),
  jobId: varchar("job_id", { length: 255 }),
  jobName: varchar("job_name", { length: 255 }).notNull(),
  jobPrefix: varchar("job_prefix", { length: 50 }), // "app", "eu-central", "oc", "us2", "ca"
  serviceStackName: varchar("service_stack_name", { length: 255 }), // "TicketingWebBackendServiceStack"
  
  // Release information (from pipeline VCS)
  branch: varchar("branch", { length: 255 }),
  releaseKey: varchar("release_key", { length: 255 }), // e.g., "v11.0.40" extracted from branch
  revision: varchar("revision", { length: 255 }), // Git commit SHA
  
  // Timing
  jobStartedAt: timestamp("job_started_at", { withTimezone: true }),
  jobStoppedAt: timestamp("job_stopped_at", { withTimezone: true }),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull(), // Used for deployment frequency window
  
  // Status
  status: varchar("status", { length: 50 }).notNull(), // "success", "failed", etc.
  failed: boolean("failed").notNull().default(false),
  
  // Metadata
  syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  projectWorkflowIdx: index("circleci_job_runs_project_workflow_idx").on(table.projectSlug, table.workflowName),
  jobPrefixIdx: index("circleci_job_runs_prefix_idx").on(table.jobPrefix),
  serviceStackIdx: index("circleci_job_runs_service_stack_idx").on(table.serviceStackName),
  releaseKeyIdx: index("circleci_job_runs_release_key_idx").on(table.releaseKey),
  timestampIdx: index("circleci_job_runs_timestamp_idx").on(table.timestamp),
  // Unique constraint: same job run (same jobId) should only be stored once
  uniqueJobRun: unique("circleci_job_runs_unique_idx").on(table.jobId),
  // Index for deployment frequency queries: group by releaseKey + serviceStackName
  deploymentGroupIdx: index("circleci_job_runs_deployment_group_idx").on(table.releaseKey, table.serviceStackName, table.timestamp),
}));
