import { z } from "zod";

export const EventSourceSchema = z.enum([
  "slack",
  "jira",
  "gitlab",
  "bitbucket",
  "pagerduty",
  "circleci",
]);
export type EventSource = z.infer<typeof EventSourceSchema>;

export const EventTypeSchema = z.enum([
  "log",
  "blocker",
  "decision",
  "release",
  "alert",
]);
export type EventType = z.infer<typeof EventTypeSchema>;

export const SeveritySchema = z.enum(["low", "medium", "high", "critical"]);
export type Severity = z.infer<typeof SeveritySchema>;

export const ProjectStatusSchema = z.enum([
  "active",
  "completed",
  "on_hold",
  "at_risk",
]);
export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;

// Context types for dynamic workspace rendering
export const ContextTypeSchema = z.enum([
  "incident",
  "support_ticket",
  "deployment_failure",
  "security_alert",
  "infrastructure",
  "general",
]);
export type ContextType = z.infer<typeof ContextTypeSchema>;

export const EventSchema = z.object({
  id: z.string().uuid(),
  // Phase 6: canonical incident linkage (IMP-032)
  // - For the incident event itself: incidentId === id
  // - For derived/related events: incidentId links back to the incident event id
  incidentId: z.string().uuid().optional(),
  timestamp: z.string().datetime(),
  source: EventSourceSchema,
  type: EventTypeSchema,
  payload: z.record(z.unknown()),
  severity: SeveritySchema,
  userId: z.string().optional(),
  username: z.string().optional(),
  message: z.string(),
  resolved: z.boolean().default(false),
  resolvedAt: z.string().datetime().optional(),
  externalLink: z.string().url().optional(),
  // Phase 4: Context-In Console fields
  contextType: ContextTypeSchema.default("general"),
  serviceTags: z.array(z.string()).default([]),
});
export type Event = z.infer<typeof EventSchema>;

export const InsertEventSchema = EventSchema.omit({ id: true });
export type InsertEvent = z.infer<typeof InsertEventSchema>;

export const ProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  status: ProjectStatusSchema,
  repositoryUrl: z.string().url().optional(),
  leadTime: z.number().optional(),
  deploymentFrequency: z.number().optional(),
  externalLink: z.string().url().optional(),
});
export type Project = z.infer<typeof ProjectSchema>;

export const InsertProjectSchema = ProjectSchema.omit({ id: true });
export type InsertProject = z.infer<typeof InsertProjectSchema>;

export const SlackCommandSchema = z.object({
  command: z.string(),
  text: z.string(),
  user_id: z.string(),
  user_name: z.string(),
  channel_id: z.string(),
  channel_name: z.string(),
  response_url: z.string().url().optional(),
});
export type SlackCommand = z.infer<typeof SlackCommandSchema>;

export const DORAMetricsSchema = z.object({
  deploymentFrequency: z.number(),
  leadTime: z.number(),
  meanTimeToRecovery: z.number(),
  changeFailureRate: z.number(),
});
export type DORAMetrics = z.infer<typeof DORAMetricsSchema>;

export const ActivityStreamResponseSchema = z.object({
  events: z.array(EventSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});
export type ActivityStreamResponse = z.infer<typeof ActivityStreamResponseSchema>;

export const UserStatsSchema = z.object({
  userId: z.string(),
  username: z.string(),
  logsThisWeek: z.number(),
  blockersResolved: z.number(),
  decisionsLogged: z.number(),
  totalEvents: z.number(),
  openBlockers: z.number().default(0),
  openPRs: z.number().default(0),
  openTickets: z.number().default(0),
  openAlerts: z.number().default(0),
  avgResponseTime: z.number().optional(),
});
export type UserStats = z.infer<typeof UserStatsSchema>;

export const HeatmapDataSchema = z.object({
  date: z.string(),
  count: z.number(),
  source: EventSourceSchema,
});
export type HeatmapData = z.infer<typeof HeatmapDataSchema>;

export const SecurityToolSchema = z.enum([
  "wiz",
  "aws_inspector",
  "artifactory_xray",
]);
export type SecurityTool = z.infer<typeof SecurityToolSchema>;

export const SecuritySeveritySchema = z.enum([
  "critical",
  "high",
  "medium",
  "low",
]);
export type SecuritySeverity = z.infer<typeof SecuritySeveritySchema>;

export const SecurityStatusSchema = z.enum([
  "open",
  "resolved",
  "ignored",
]);
export type SecurityStatus = z.infer<typeof SecurityStatusSchema>;

export const SecurityFindingSchema = z.object({
  id: z.string().uuid(),
  severity: SecuritySeveritySchema,
  tool: SecurityToolSchema,
  cve: z.string().optional(),
  asset: z.string(),
  status: SecurityStatusSchema,
  title: z.string(),
  description: z.string().optional(),
  detectedAt: z.string().datetime(),
  resolvedAt: z.string().datetime().optional(),
  externalLink: z.string().url().optional(),
});
export type SecurityFinding = z.infer<typeof SecurityFindingSchema>;

export const InsertSecurityFindingSchema = SecurityFindingSchema.omit({ id: true });
export type InsertSecurityFinding = z.infer<typeof InsertSecurityFindingSchema>;

export const ReportStyleSchema = z.enum([
  "executive",
  "standup",
  "stakeholder",
]);
export type ReportStyle = z.infer<typeof ReportStyleSchema>;

export const ReportRequestSchema = z.object({
  style: ReportStyleSchema,
  days: z.number().int().min(1).max(30).default(7),
  sources: z.array(EventSourceSchema).optional(),
});
export type ReportRequest = z.infer<typeof ReportRequestSchema>;

export const AgentReportSchema = z.object({
  id: z.string().uuid(),
  style: ReportStyleSchema,
  content: z.string(),
  generatedAt: z.string().datetime(),
  eventCount: z.number(),
  timeRangeDays: z.number(),
});
export type AgentReport = z.infer<typeof AgentReportSchema>;

export const VulnerabilityHeatmapDataSchema = z.object({
  date: z.string(),
  count: z.number(),
  tool: SecurityToolSchema,
  severity: SecuritySeveritySchema,
});
export type VulnerabilityHeatmapData = z.infer<typeof VulnerabilityHeatmapDataSchema>;

// Comment schema for events
export const CommentSchema = z.object({
  id: z.string().uuid(),
  eventId: z.string().uuid(),
  userId: z.string(),
  username: z.string(),
  content: z.string(),
  createdAt: z.string().datetime(),
});
export type Comment = z.infer<typeof CommentSchema>;

export const InsertCommentSchema = CommentSchema.omit({ id: true, createdAt: true });
export type InsertComment = z.infer<typeof InsertCommentSchema>;

// Event update schema
export const EventUpdateSchema = z.object({
  severity: SeveritySchema.optional(),
  resolved: z.boolean().optional(),
  resolvedAt: z.string().datetime().optional().nullable(),
  payload: z.record(z.unknown()).optional(),
});
export type EventUpdate = z.infer<typeof EventUpdateSchema>;

// User profile schema
export const UserProfileSchema = z.object({
  userId: z.string(),
  username: z.string(),
  avatar: z.string().optional(),
  email: z.string().email().optional(),
  role: z.string().optional(),
  department: z.string().optional(),
  stats: UserStatsSchema,
  recentEvents: z.array(EventSchema),
  assignedItems: z.array(EventSchema),
});
export type UserProfile = z.infer<typeof UserProfileSchema>;

// ============================================
// PHASE 3: Operations Hub - Action & Orchestration
// ============================================

// Action Categories for Service Catalog
export const ActionCategorySchema = z.enum([
  "provisioning",
  "remediation",
  "data",
  "deployment",
]);
export type ActionCategory = z.infer<typeof ActionCategorySchema>;

// Risk levels for actions
export const RiskLevelSchema = z.enum(["low", "medium", "high", "critical"]);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

// User roles for RBAC
export const UserRoleSchema = z.enum(["viewer", "dev", "sre", "admin"]);
export type UserRole = z.infer<typeof UserRoleSchema>;

// Parameter type definitions for dynamic form generation
export const ParamTypeSchema = z.enum([
  "string",
  "number",
  "boolean",
  "select",
  "email",
  "url",
]);
export type ParamType = z.infer<typeof ParamTypeSchema>;

// Parameter definition schema
export const ActionParamSchema = z.object({
  name: z.string(),
  type: ParamTypeSchema,
  label: z.string(),
  required: z.boolean().default(true),
  placeholder: z.string().optional(),
  options: z.array(z.string()).optional(),
  validation: z.string().optional(),
});
export type ActionParam = z.infer<typeof ActionParamSchema>;

// Action schema for the Service Catalog
export const ActionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: ActionCategorySchema,
  riskLevel: RiskLevelSchema,
  requiredParams: z.array(ActionParamSchema),
  workflowId: z.string().optional(),
  icon: z.string().optional(),
  estimatedDuration: z.string().optional(),
  requiredRoles: z.array(UserRoleSchema),
  // Phase 4: Context-aware targeting
  targetServices: z.array(z.string()).default([]),
  contextTypes: z.array(ContextTypeSchema).default([]),
});
export type Action = z.infer<typeof ActionSchema>;

// Workflow execution status
export const WorkflowStatusSchema = z.enum([
  "pending",
  "pending_approval",
  "approved",
  "rejected",
  "running",
  "completed",
  "failed",
  "cancelled",
]);
export type WorkflowStatus = z.infer<typeof WorkflowStatusSchema>;

// Workflow execution record
export const WorkflowExecutionSchema = z.object({
  id: z.string().uuid(),
  runId: z.string(),
  actionId: z.string(),
  actionName: z.string(),
  status: WorkflowStatusSchema,
  params: z.record(z.unknown()),
  reasoning: z.string(),
  executedBy: z.string(),
  executedByUsername: z.string(),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  approvedBy: z.string().optional(),
  approvedAt: z.string().datetime().optional(),
  output: z.array(z.string()).optional(),
  error: z.string().optional(),
  // Phase 5: workflow context for cross-incident approvals + audit views
  context: z
    .object({
      eventId: z.string().uuid().optional(),
      incidentId: z.string().uuid().optional(),
      contextType: ContextTypeSchema.optional(),
      serviceTags: z.array(z.string()).optional(),
    })
    .optional(),
});
export type WorkflowExecution = z.infer<typeof WorkflowExecutionSchema>;

export const InsertWorkflowExecutionSchema = WorkflowExecutionSchema.omit({ id: true });
export type InsertWorkflowExecution = z.infer<typeof InsertWorkflowExecutionSchema>;

// ============================================
// Phase 6: Incident-scoped Timeline (server-joined convenience)
// ============================================

export const IncidentTimelineResponseSchema = z.object({
  incidentId: z.string().uuid(),
  events: z.array(EventSchema),
  executions: z.array(WorkflowExecutionSchema),
});
export type IncidentTimelineResponse = z.infer<typeof IncidentTimelineResponseSchema>;

// Permission schema for RBAC
export const PermissionSchema = z.object({
  role: UserRoleSchema,
  allowedActions: z.array(z.string()),
  allowedRiskLevels: z.array(RiskLevelSchema),
  canApprove: z.boolean().default(false),
});
export type Permission = z.infer<typeof PermissionSchema>;

// Execute action request
export const ExecuteActionRequestSchema = z.object({
  actionId: z.string(),
  params: z.record(z.unknown()),
  reasoning: z.string().min(10, "Reasoning must be at least 10 characters"),
  // Phase 5: propagate the triggering context (incident/event + service tags) into execution records.
  context: z
    .object({
      eventId: z.string().uuid().optional(),
      incidentId: z.string().uuid().optional(),
      contextType: ContextTypeSchema.optional(),
      serviceTags: z.array(z.string()).optional(),
    })
    .optional(),
});
export type ExecuteActionRequest = z.infer<typeof ExecuteActionRequestSchema>;

// Approval request/response
export const ApprovalActionSchema = z.enum(["approve", "reject"]);
export type ApprovalAction = z.infer<typeof ApprovalActionSchema>;

export const ApprovalRequestSchema = z.object({
  executionId: z.string().uuid(),
  action: ApprovalActionSchema,
  comment: z.string().optional(),
});
export type ApprovalRequest = z.infer<typeof ApprovalRequestSchema>;

// ============================================
// Safe SQL Runner - Parameterized Queries
// ============================================

// SQL query template types
export const QueryTemplateTypeSchema = z.enum([
  "read",
  "aggregate",
]);
export type QueryTemplateType = z.infer<typeof QueryTemplateTypeSchema>;

// SQL query template schema
export const QueryTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  templateSql: z.string(),
  type: QueryTemplateTypeSchema,
  params: z.array(ActionParamSchema),
  requiredRoles: z.array(UserRoleSchema),
});
export type QueryTemplate = z.infer<typeof QueryTemplateSchema>;

// SQL query execution request
export const QueryExecutionRequestSchema = z.object({
  templateId: z.string(),
  params: z.record(z.unknown()),
});
export type QueryExecutionRequest = z.infer<typeof QueryExecutionRequestSchema>;

// SQL query execution result
export const QueryExecutionResultSchema = z.object({
  id: z.string().uuid(),
  templateId: z.string(),
  templateName: z.string(),
  executedBy: z.string(),
  executedByUsername: z.string(),
  executedAt: z.string().datetime(),
  rowCount: z.number(),
  columns: z.array(z.string()),
  rows: z.array(z.record(z.unknown())),
  executionTimeMs: z.number(),
});
export type QueryExecutionResult = z.infer<typeof QueryExecutionResultSchema>;

// ============================================
// Catalog Response Types
// ============================================

export const ActionCatalogResponseSchema = z.object({
  actions: z.array(ActionSchema),
  categories: z.array(z.object({
    id: ActionCategorySchema,
    name: z.string(),
    count: z.number(),
  })),
});
export type ActionCatalogResponse = z.infer<typeof ActionCatalogResponseSchema>;

export const PendingApprovalsResponseSchema = z.object({
  executions: z.array(WorkflowExecutionSchema),
  total: z.number(),
});
export type PendingApprovalsResponse = z.infer<typeof PendingApprovalsResponseSchema>;

// ============================================
// Phase 5: Runbooks (UI catalog + content)
// ============================================

export const RunbookSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  filename: z.string(),
  updatedAt: z.string().datetime().optional(),
});
export type RunbookSummary = z.infer<typeof RunbookSummarySchema>;

export const RunbookDetailSchema = RunbookSummarySchema.extend({
  content: z.string(),
});
export type RunbookDetail = z.infer<typeof RunbookDetailSchema>;

export const RunbookListResponseSchema = z.object({
  runbooks: z.array(RunbookSummarySchema),
});
export type RunbookListResponse = z.infer<typeof RunbookListResponseSchema>;

// ============================================
// MODULE A: Service Graph / Service Catalog
// ============================================

export const ServiceTierSchema = z.enum(["tier1", "tier2", "tier3"]);
export type ServiceTier = z.infer<typeof ServiceTierSchema>;

export const ServiceHealthSchema = z.enum(["healthy", "degraded", "critical", "unknown"]);
export type ServiceHealth = z.infer<typeof ServiceHealthSchema>;

export const ServiceTypeSchema = z.enum(["api", "worker", "database", "cache", "gateway", "frontend", "ml", "storage"]);
export type ServiceType = z.infer<typeof ServiceTypeSchema>;

export const TeamSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  lead: z.string(),
  slackChannel: z.string().optional(),
  oncallRotation: z.string().optional(),
});
export type Team = z.infer<typeof TeamSchema>;

export const ServiceSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  type: ServiceTypeSchema,
  tier: ServiceTierSchema,
  health: ServiceHealthSchema,
  teamId: z.string(),
  repositoryUrl: z.string().url().optional(),
  documentationUrl: z.string().url().optional(),
  dashboardUrl: z.string().url().optional(),
  dependencies: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  language: z.string().optional(),
  lastDeployedAt: z.string().datetime().optional(),
  version: z.string().optional(),
  errorRate: z.number().optional(),
  latencyP50: z.number().optional(),
  latencyP99: z.number().optional(),
  requestsPerSecond: z.number().optional(),
  cpuUsage: z.number().optional(),
  memoryUsage: z.number().optional(),
  openIncidents: z.number().default(0),
  openVulnerabilities: z.number().default(0),
  monthlyCost: z.number().optional(),
});
export type Service = z.infer<typeof ServiceSchema>;

export const InsertServiceSchema = ServiceSchema.omit({ id: true });
export type InsertService = z.infer<typeof InsertServiceSchema>;

export const InsertTeamSchema = TeamSchema.omit({ id: true });
export type InsertTeam = z.infer<typeof InsertTeamSchema>;

export const ServiceCatalogResponseSchema = z.object({
  services: z.array(ServiceSchema),
  teams: z.array(TeamSchema),
  total: z.number(),
});
export type ServiceCatalogResponse = z.infer<typeof ServiceCatalogResponseSchema>;

// ============================================
// Phase 4.1+: Workbench capability exploration surfaces
// ============================================

export const WorkbenchExplorerKindSchema = z.enum(["openapi", "graphql", "none"]);
export type WorkbenchExplorerKind = z.infer<typeof WorkbenchExplorerKindSchema>;

export const WorkbenchExplorerConnectionTypeSchema = z.enum(["github", "jira", "gitlab", "none"]);
export type WorkbenchExplorerConnectionType = z.infer<typeof WorkbenchExplorerConnectionTypeSchema>;

export const WorkbenchToolExplorationSchema = z.object({
  kind: WorkbenchExplorerKindSchema,
  connectionType: WorkbenchExplorerConnectionTypeSchema,
});
export type WorkbenchToolExploration = z.infer<typeof WorkbenchToolExplorationSchema>;

// ============================================
// Phase 4.1.5+: Workbench approvals (audit log)
// ============================================

export const WorkbenchApprovalLogContextSchema = z.object({
  incidentId: z.string().optional(),
  workflowId: z.string().optional(),
  draftTitle: z.string().optional(),
  contextType: z.string().optional(),
});
export type WorkbenchApprovalLogContext = z.infer<typeof WorkbenchApprovalLogContextSchema>;

export const WorkbenchApprovalLogEntrySchema = z.object({
  id: z.string(),
  approverId: z.string(),
  timestamp: z.string().datetime(),
  approvedToolIds: z.array(z.string()).min(1),
  context: WorkbenchApprovalLogContextSchema.optional(),
});
export type WorkbenchApprovalLogEntry = z.infer<typeof WorkbenchApprovalLogEntrySchema>;

export const WorkbenchApprovalLogListResponseSchema = z.object({
  entries: z.array(WorkbenchApprovalLogEntrySchema),
});
export type WorkbenchApprovalLogListResponse = z.infer<typeof WorkbenchApprovalLogListResponseSchema>;

// ============================================
// AI Agent Chat Schemas
// ============================================

export const ChatToolStatusSchema = z.enum(["pending", "success", "error"]);
export type ChatToolStatus = z.infer<typeof ChatToolStatusSchema>;

export const ChatToolCallSchema = z.object({
  tool: z.string(),
  status: ChatToolStatusSchema,
  result: z.string().optional(),
  params: z.record(z.unknown()).optional(),
});
export type ChatToolCall = z.infer<typeof ChatToolCallSchema>;

export const ChatMessageRoleSchema = z.enum(["user", "assistant", "system"]);
export type ChatMessageRole = z.infer<typeof ChatMessageRoleSchema>;

export const ChatMessageSchema = z.object({
  id: z.string().uuid(),
  role: ChatMessageRoleSchema,
  content: z.string(),
  timestamp: z.string().datetime(),
  toolCalls: z.array(ChatToolCallSchema).optional(),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const ChatRequestSchema = z.object({
  message: z.string().min(1),
  conversationId: z.string().uuid().optional(),
  context: z.object({
    currentPage: z.string().optional(),
    selectedServiceId: z.string().optional(),
    selectedEventId: z.string().optional(),
  }).optional(),
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export const ChatResponseSchema = z.object({
  message: ChatMessageSchema,
  conversationId: z.string().uuid(),
});
export type ChatResponse = z.infer<typeof ChatResponseSchema>;

// Agent Tool Definitions
export const AgentToolSchema = z.object({
  name: z.string(),
  description: z.string(),
  category: z.enum(["query", "action", "report"]),
  provider: z.string().optional(),
  parameters: z.array(z.object({
    name: z.string(),
    type: z.string(),
    description: z.string(),
    required: z.boolean(),
  })),
});
export type AgentTool = z.infer<typeof AgentToolSchema>;

// LLM Provider Interface (provider-agnostic)
export const LLMProviderSchema = z.enum(["openai", "anthropic", "gemini", "mock"]);
export type LLMProvider = z.infer<typeof LLMProviderSchema>;
