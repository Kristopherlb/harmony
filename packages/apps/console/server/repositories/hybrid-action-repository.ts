import type { IActionRepository } from "../action-repository";
import { SeedableActionRepository } from "../action-repository";
import type {
  Action,
  ActionCategory,
  WorkflowExecution,
  QueryTemplate,
  Permission,
  UserRole,
} from "@shared/schema";

export interface ActionExecutionStore {
  createExecution(execution: Omit<WorkflowExecution, "id">): Promise<WorkflowExecution>;
  getExecution(id: string): Promise<WorkflowExecution | undefined>;
  getExecutionByRunId(runId: string): Promise<WorkflowExecution | undefined>;
  updateExecution(id: string, updates: Partial<WorkflowExecution>): Promise<WorkflowExecution | undefined>;
  getExecutionsByUser(userId: string): Promise<WorkflowExecution[]>;
  getPendingApprovals(scope?: { eventId?: string; incidentId?: string; serviceTag?: string }): Promise<WorkflowExecution[]>;
  getRecentExecutions(
    limit?: number,
    scope?: { eventId?: string; incidentId?: string; serviceTag?: string }
  ): Promise<WorkflowExecution[]>;
}

/**
 * HybridActionRepository delegates:
 * - action catalog/templates/permissions → SeedableActionRepository (in-memory)
 * - execution storage → an injected ActionExecutionStore (e.g. PostgresActionExecutionRepository)
 */
export class HybridActionRepository implements IActionRepository {
  constructor(
    private readonly catalog: SeedableActionRepository,
    private readonly executionStore: ActionExecutionStore
  ) {}

  async getActions(): Promise<Action[]> {
    return this.catalog.getActions();
  }

  async getActionById(id: string): Promise<Action | undefined> {
    return this.catalog.getActionById(id);
  }

  async getActionsByCategory(category: ActionCategory): Promise<Action[]> {
    return this.catalog.getActionsByCategory(category);
  }

  async createExecution(execution: Omit<WorkflowExecution, "id">): Promise<WorkflowExecution> {
    return this.executionStore.createExecution(execution);
  }

  async getExecution(id: string): Promise<WorkflowExecution | undefined> {
    return this.executionStore.getExecution(id);
  }

  async getExecutionByRunId(runId: string): Promise<WorkflowExecution | undefined> {
    return this.executionStore.getExecutionByRunId(runId);
  }

  async updateExecution(id: string, updates: Partial<WorkflowExecution>): Promise<WorkflowExecution | undefined> {
    return this.executionStore.updateExecution(id, updates);
  }

  async getExecutionsByUser(userId: string): Promise<WorkflowExecution[]> {
    return this.executionStore.getExecutionsByUser(userId);
  }

  async getPendingApprovals(scope?: { eventId?: string; incidentId?: string; serviceTag?: string }): Promise<WorkflowExecution[]> {
    return this.executionStore.getPendingApprovals(scope);
  }

  async getRecentExecutions(limit?: number, scope?: { eventId?: string; incidentId?: string; serviceTag?: string }): Promise<WorkflowExecution[]> {
    return this.executionStore.getRecentExecutions(limit, scope);
  }

  async getQueryTemplates(): Promise<QueryTemplate[]> {
    return this.catalog.getQueryTemplates();
  }

  async getQueryTemplateById(id: string): Promise<QueryTemplate | undefined> {
    return this.catalog.getQueryTemplateById(id);
  }

  getPermissions(role: UserRole): Permission | undefined {
    return this.catalog.getPermissions(role);
  }

  canExecuteAction(role: UserRole, action: Action): boolean {
    return this.catalog.canExecuteAction(role, action);
  }

  canApprove(role: UserRole): boolean {
    return this.catalog.canApprove(role);
  }
}

