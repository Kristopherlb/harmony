import { v4 as uuidv4 } from "uuid";
import type {
  Action,
  ActionCategory,
  WorkflowExecution,
  WorkflowStatus,
  ExecuteActionRequest,
  Permission,
  UserRole,
  RiskLevel,
  QueryTemplate,
  QueryExecutionResult,
} from "@shared/schema";

export interface IActionRepository {
  getActions(): Promise<Action[]>;
  getActionById(id: string): Promise<Action | undefined>;
  getActionsByCategory(category: ActionCategory): Promise<Action[]>;

  createExecution(execution: Omit<WorkflowExecution, "id">): Promise<WorkflowExecution>;
  getExecution(id: string): Promise<WorkflowExecution | undefined>;
  getExecutionByRunId(runId: string): Promise<WorkflowExecution | undefined>;
  updateExecution(id: string, updates: Partial<WorkflowExecution>): Promise<WorkflowExecution | undefined>;
  getExecutionsByUser(userId: string): Promise<WorkflowExecution[]>;
  getPendingApprovals(): Promise<WorkflowExecution[]>;
  getRecentExecutions(limit?: number): Promise<WorkflowExecution[]>;

  getQueryTemplates(): Promise<QueryTemplate[]>;
  getQueryTemplateById(id: string): Promise<QueryTemplate | undefined>;

  getPermissions(role: UserRole): Permission | undefined;
  canExecuteAction(role: UserRole, action: Action): boolean;
  canApprove(role: UserRole): boolean;
}

const DEFAULT_PERMISSIONS: Permission[] = [
  {
    role: "viewer",
    allowedActions: [],
    allowedRiskLevels: [],
    canApprove: false,
  },
  {
    role: "dev",
    allowedActions: ["*"],
    allowedRiskLevels: ["low", "medium"],
    canApprove: false,
  },
  {
    role: "sre",
    allowedActions: ["*"],
    allowedRiskLevels: ["low", "medium", "high"],
    canApprove: true,
  },
  {
    role: "admin",
    allowedActions: ["*"],
    allowedRiskLevels: ["low", "medium", "high", "critical"],
    canApprove: true,
  },
];

const CATALOG_ACTIONS: Action[] = [
  {
    id: "provision-dev-env",
    name: "Provision Dev Environment",
    description: "Create a new development environment with all required services",
    category: "provisioning",
    riskLevel: "low",
    requiredParams: [
      { name: "envName", type: "string", label: "Environment Name", required: true, placeholder: "my-dev-env" },
      { name: "region", type: "select", label: "Region", required: true, options: ["us-east-1", "us-west-2", "eu-west-1"] },
      { name: "includeDb", type: "boolean", label: "Include Database", required: false },
    ],
    workflowId: "provision-dev-env-workflow",
    icon: "server",
    estimatedDuration: "5-10 min",
    requiredRoles: ["dev", "sre", "admin"],
    targetServices: [],
    contextTypes: [],
  },
  {
    id: "restart-pods",
    name: "Restart Pods",
    description: "Restart pods in a Kubernetes namespace",
    category: "remediation",
    riskLevel: "medium",
    requiredParams: [
      { name: "namespace", type: "select", label: "Namespace", required: true, options: ["production", "staging", "development"] },
      { name: "deployment", type: "string", label: "Deployment Name", required: true, placeholder: "api-server" },
      { name: "gracePeriod", type: "number", label: "Grace Period (seconds)", required: false, placeholder: "30" },
    ],
    workflowId: "restart-pods-workflow",
    icon: "refresh-cw",
    estimatedDuration: "1-3 min",
    requiredRoles: ["sre", "admin"],
    targetServices: ["kubernetes", "gateway", "api", "web", "envoy"],
    contextTypes: ["incident", "deployment_failure"],
  },
  {
    id: "flush-redis-cache",
    name: "Flush Redis Cache",
    description: "Clear Redis cache for a specific service or pattern",
    category: "remediation",
    riskLevel: "medium",
    requiredParams: [
      { name: "cluster", type: "select", label: "Redis Cluster", required: true, options: ["sessions", "api-cache", "feature-flags"] },
      { name: "pattern", type: "string", label: "Key Pattern", required: false, placeholder: "user:*" },
    ],
    workflowId: "flush-redis-workflow",
    icon: "database",
    estimatedDuration: "< 1 min",
    requiredRoles: ["sre", "admin"],
    targetServices: ["redis", "cache", "sessions"],
    contextTypes: ["incident", "infrastructure"],
  },
  {
    id: "scale-asg",
    name: "Scale Auto Scaling Group",
    description: "Adjust the desired capacity of an AWS Auto Scaling Group",
    category: "remediation",
    riskLevel: "high",
    requiredParams: [
      { name: "asgName", type: "string", label: "ASG Name", required: true, placeholder: "api-server-asg" },
      { name: "desiredCapacity", type: "number", label: "Desired Capacity", required: true, placeholder: "4" },
      { name: "minSize", type: "number", label: "Min Size", required: false },
      { name: "maxSize", type: "number", label: "Max Size", required: false },
    ],
    workflowId: "scale-asg-workflow",
    icon: "trending-up",
    estimatedDuration: "3-5 min",
    requiredRoles: ["sre", "admin"],
    targetServices: ["aws", "asg", "api", "gateway"],
    contextTypes: ["incident", "infrastructure"],
  },
  {
    id: "deploy-hotfix",
    name: "Deploy Hotfix",
    description: "Deploy a hotfix to production with expedited review",
    category: "deployment",
    riskLevel: "critical",
    requiredParams: [
      { name: "service", type: "select", label: "Service", required: true, options: ["api", "web", "worker", "gateway"] },
      { name: "version", type: "string", label: "Version/Tag", required: true, placeholder: "v2.4.1-hotfix" },
      { name: "rollbackVersion", type: "string", label: "Rollback Version", required: true, placeholder: "v2.4.0" },
      { name: "jiraTicket", type: "string", label: "JIRA Ticket", required: true, placeholder: "OPS-1234" },
    ],
    workflowId: "deploy-hotfix-workflow",
    icon: "rocket",
    estimatedDuration: "10-15 min",
    requiredRoles: ["sre", "admin"],
    targetServices: ["api", "web", "worker", "gateway"],
    contextTypes: ["incident", "deployment_failure"],
  },
  {
    id: "drop-database",
    name: "Drop Database",
    description: "DANGER: Permanently delete a database. This action cannot be undone.",
    category: "data",
    riskLevel: "critical",
    requiredParams: [
      { name: "database", type: "string", label: "Database Name", required: true, placeholder: "test_db" },
      { name: "confirmName", type: "string", label: "Type database name to confirm", required: true },
    ],
    workflowId: "drop-database-workflow",
    icon: "trash-2",
    estimatedDuration: "1-2 min",
    requiredRoles: ["admin"],
    targetServices: ["database", "postgres", "mysql"],
    contextTypes: ["infrastructure"],
  },
  {
    id: "vacuum-database",
    name: "Vacuum Database",
    description: "Run VACUUM ANALYZE on PostgreSQL database tables to reclaim space",
    category: "data",
    riskLevel: "medium",
    requiredParams: [
      { name: "database", type: "select", label: "Database", required: true, options: ["production", "staging", "analytics"] },
      { name: "tableName", type: "string", label: "Table Name (optional)", required: false, placeholder: "users" },
    ],
    workflowId: "vacuum-database-workflow",
    icon: "hard-drive",
    estimatedDuration: "5-30 min",
    requiredRoles: ["sre", "admin"],
    targetServices: ["database", "postgres"],
    contextTypes: ["infrastructure"],
  },
  {
    id: "restart-envoy",
    name: "Restart Envoy Pods",
    description: "Rolling restart of Envoy proxy pods in the service mesh",
    category: "remediation",
    riskLevel: "medium",
    requiredParams: [
      { name: "namespace", type: "select", label: "Namespace", required: true, options: ["production", "staging"] },
      { name: "graceful", type: "boolean", label: "Graceful Drain", required: false },
    ],
    workflowId: "restart-envoy-workflow",
    icon: "refresh-cw",
    estimatedDuration: "2-5 min",
    requiredRoles: ["sre", "admin"],
    targetServices: ["envoy", "gateway", "api-gateway"],
    contextTypes: ["incident", "infrastructure"],
  },
];

const QUERY_TEMPLATES: QueryTemplate[] = [
  {
    id: "query-user-by-email",
    name: "Query User by Email",
    description: "Find a user record by their email address",
    templateSql: "SELECT id, username, email, created_at, last_login FROM users WHERE email = $1",
    type: "read",
    params: [
      { name: "email", type: "email", label: "Email Address", required: true, placeholder: "user@company.com" },
    ],
    requiredRoles: ["dev", "sre", "admin"],
  },
  {
    id: "query-user-by-id",
    name: "Query User by ID",
    description: "Find a user record by their user ID",
    templateSql: "SELECT id, username, email, created_at, last_login FROM users WHERE id = $1",
    type: "read",
    params: [
      { name: "userId", type: "string", label: "User ID", required: true, placeholder: "U001" },
    ],
    requiredRoles: ["dev", "sre", "admin"],
  },
  {
    id: "count-events-by-source",
    name: "Count Events by Source",
    description: "Get event counts grouped by source for a time range",
    templateSql: "SELECT source, COUNT(*) as count FROM events WHERE timestamp >= $1 AND timestamp <= $2 GROUP BY source",
    type: "aggregate",
    params: [
      { name: "startDate", type: "string", label: "Start Date", required: true, placeholder: "2024-01-01" },
      { name: "endDate", type: "string", label: "End Date", required: true, placeholder: "2024-01-31" },
    ],
    requiredRoles: ["dev", "sre", "admin"],
  },
  {
    id: "find-active-blockers",
    name: "Find Active Blockers",
    description: "List all unresolved blockers with their age",
    templateSql: "SELECT id, message, severity, username, timestamp, EXTRACT(EPOCH FROM (NOW() - timestamp))/3600 as age_hours FROM events WHERE type = 'blocker' AND resolved = false ORDER BY timestamp DESC LIMIT $1",
    type: "read",
    params: [
      { name: "limit", type: "number", label: "Max Results", required: false, placeholder: "50" },
    ],
    requiredRoles: ["dev", "sre", "admin"],
  },
];

export class SeedableActionRepository implements IActionRepository {
  private actions: Map<string, Action> = new Map();
  private executions: Map<string, WorkflowExecution> = new Map();
  private queryTemplates: Map<string, QueryTemplate> = new Map();
  private permissions: Map<UserRole, Permission> = new Map();

  constructor() {
    for (const action of CATALOG_ACTIONS) {
      this.actions.set(action.id, action);
    }
    for (const template of QUERY_TEMPLATES) {
      this.queryTemplates.set(template.id, template);
    }
    for (const permission of DEFAULT_PERMISSIONS) {
      this.permissions.set(permission.role, permission);
    }
  }

  async getActions(): Promise<Action[]> {
    return Array.from(this.actions.values());
  }

  async getActionById(id: string): Promise<Action | undefined> {
    return this.actions.get(id);
  }

  async getActionsByCategory(category: ActionCategory): Promise<Action[]> {
    return Array.from(this.actions.values()).filter((a) => a.category === category);
  }

  async createExecution(execution: Omit<WorkflowExecution, "id">): Promise<WorkflowExecution> {
    const id = uuidv4();
    const fullExecution: WorkflowExecution = { id, ...execution };
    this.executions.set(id, fullExecution);
    return fullExecution;
  }

  async getExecution(id: string): Promise<WorkflowExecution | undefined> {
    return this.executions.get(id);
  }

  async getExecutionByRunId(runId: string): Promise<WorkflowExecution | undefined> {
    return Array.from(this.executions.values()).find((e) => e.runId === runId);
  }

  async updateExecution(
    id: string,
    updates: Partial<WorkflowExecution>
  ): Promise<WorkflowExecution | undefined> {
    const execution = this.executions.get(id);
    if (!execution) return undefined;

    const updated = { ...execution, ...updates };
    this.executions.set(id, updated);
    return updated;
  }

  async getExecutionsByUser(userId: string): Promise<WorkflowExecution[]> {
    return Array.from(this.executions.values())
      .filter((e) => e.executedBy === userId)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }

  async getPendingApprovals(): Promise<WorkflowExecution[]> {
    return Array.from(this.executions.values())
      .filter((e) => e.status === "pending_approval")
      .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());
  }

  async getRecentExecutions(limit: number = 20): Promise<WorkflowExecution[]> {
    return Array.from(this.executions.values())
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .slice(0, limit);
  }

  async getQueryTemplates(): Promise<QueryTemplate[]> {
    return Array.from(this.queryTemplates.values());
  }

  async getQueryTemplateById(id: string): Promise<QueryTemplate | undefined> {
    return this.queryTemplates.get(id);
  }

  getPermissions(role: UserRole): Permission | undefined {
    return this.permissions.get(role);
  }

  canExecuteAction(role: UserRole, action: Action): boolean {
    const permission = this.permissions.get(role);
    if (!permission) return false;

    if (!action.requiredRoles.includes(role)) return false;

    const hasActionPermission =
      permission.allowedActions.includes("*") || permission.allowedActions.includes(action.id);

    const hasRiskPermission = permission.allowedRiskLevels.includes(action.riskLevel);

    return hasActionPermission && hasRiskPermission;
  }

  canApprove(role: UserRole): boolean {
    const permission = this.permissions.get(role);
    return permission?.canApprove ?? false;
  }

  seedExecution(execution: WorkflowExecution): void {
    this.executions.set(execution.id, execution);
  }

  clearExecutions(): void {
    this.executions.clear();
  }
}

export const actionRepository = new SeedableActionRepository();
