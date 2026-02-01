// server/actions/domain/types.ts
// Domain types for actions context - server-internal domain model

export type ActionCategory = "provisioning" | "remediation" | "data" | "deployment";
export type RiskLevel = "low" | "medium" | "high" | "critical";
export type UserRole = "viewer" | "dev" | "sre" | "admin";
export type WorkflowStatus = "pending" | "pending_approval" | "approved" | "rejected" | "running" | "completed" | "failed" | "cancelled";
export type ContextType = "incident" | "support_ticket" | "deployment_failure" | "security_alert" | "infrastructure" | "general";

export interface ActionParam {
  name: string;
  type: "string" | "number" | "boolean" | "select" | "email" | "url";
  label: string;
  required: boolean;
  placeholder?: string;
  options?: string[];
  validation?: string;
}

export interface Action {
  id: string;
  name: string;
  description: string;
  category: ActionCategory;
  riskLevel: RiskLevel;
  requiredParams: ActionParam[];
  workflowId?: string;
  icon?: string;
  estimatedDuration?: string;
  requiredRoles: UserRole[];
  targetServices: string[];
  contextTypes: ContextType[];
}

export interface WorkflowExecution {
  id: string;
  runId: string;
  actionId: string;
  actionName: string;
  status: WorkflowStatus;
  params: Record<string, unknown>;
  reasoning: string;
  executedBy: string;
  executedByUsername: string;
  startedAt: Date;
  completedAt?: Date;
  approvedBy?: string;
  approvedAt?: Date;
  output?: string[];
  error?: string;
}

export interface ExecuteActionRequest {
  actionId: string;
  params: Record<string, unknown>;
  reasoning: string;
}

export interface Permission {
  role: UserRole;
  allowedActions: string[];
  allowedRiskLevels: RiskLevel[];
  canApprove: boolean;
}

export interface QueryTemplate {
  id: string;
  name: string;
  description: string;
  templateSql: string;
  type: "read" | "aggregate";
  params: ActionParam[];
  requiredRoles: UserRole[];
}
