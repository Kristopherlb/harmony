// server/actions/application/ports.ts
// Application ports (interfaces) for actions context

import type {
  Action,
  ActionCategory,
  WorkflowExecution,
  WorkflowStatus,
  ExecuteActionRequest,
  Permission,
  UserRole,
  QueryTemplate,
} from "../domain/types";

export interface ActionRepositoryPort {
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
}

export interface WorkflowEnginePort {
  startWorkflow(
    action: Action,
    request: ExecuteActionRequest,
    userId: string,
    username: string
  ): Promise<{ runId: string; status: WorkflowStatus; requiresApproval: boolean }>;

  getWorkflowStatus(runId: string): Promise<{ runId: string; status: WorkflowStatus; output: string[]; error?: string } | null>;

  cancelWorkflow(runId: string): Promise<boolean>;

  approveWorkflow(runId: string, approverId: string): Promise<boolean>;

  rejectWorkflow(runId: string, approverId: string, reason?: string): Promise<boolean>;
}

export interface PermissionServicePort {
  getPermissions(role: UserRole): Permission | undefined;
  canExecuteAction(role: UserRole, action: Action): boolean;
  canApprove(role: UserRole): boolean;
}

export interface EventIngestionPort {
  createEvent(event: {
    incidentId?: string;
    timestamp: string;
    source: string;
    type: string;
    payload: Record<string, unknown>;
    severity: string;
    userId: string;
    username: string;
    message: string;
    resolved: boolean;
    contextType: string;
    serviceTags: string[];
    resolvedAt?: string;
  }): Promise<{ id: string }>;
}
