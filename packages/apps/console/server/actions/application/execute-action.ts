// server/actions/application/execute-action.ts
// Use case: Execute an action with RBAC and approval workflow

import type { ExecuteActionRequest, UserRole, WorkflowExecution } from "../domain/types";
import type { ActionRepositoryPort, WorkflowEnginePort, PermissionServicePort, EventIngestionPort } from "./ports";

export interface ExecuteActionUseCaseRequest {
  request: ExecuteActionRequest;
  userId: string;
  username: string;
  role: UserRole;
}

export interface ExecuteActionUseCaseResponse {
  execution: WorkflowExecution;
  requiresApproval: boolean;
  message: string;
}

export class ExecuteAction {
  constructor(
    private actionRepository: ActionRepositoryPort,
    private workflowEngine: WorkflowEnginePort,
    private permissionService: PermissionServicePort,
    private eventIngestion: EventIngestionPort
  ) {}

  async execute(useCaseRequest: ExecuteActionUseCaseRequest): Promise<ExecuteActionUseCaseResponse> {
    const { request, userId, username, role } = useCaseRequest;

    const action = await this.actionRepository.getActionById(request.actionId);
    if (!action) {
      throw new Error("Action not found");
    }

    if (!this.permissionService.canExecuteAction(role, action)) {
      throw new Error("Insufficient permissions");
    }

    const result = await this.workflowEngine.startWorkflow(action, request, userId, username);

    const execution = await this.actionRepository.createExecution({
      runId: result.runId,
      actionId: action.id,
      actionName: action.name,
      status: result.status,
      params: request.params,
      reasoning: request.reasoning,
      executedBy: userId,
      executedByUsername: username,
      startedAt: new Date(),
      output: [],
    });

    await this.eventIngestion.createEvent({
      timestamp: new Date().toISOString(),
      source: "slack",
      type: "log",
      payload: {
        actionType: "workflow_execution",
        actionId: action.id,
        actionName: action.name,
        runId: result.runId,
        status: result.status,
        riskLevel: action.riskLevel,
      },
      severity: action.riskLevel === "critical" ? "high" : "medium",
      userId,
      username,
      message: `Action Executed: ${action.name} (${result.status})`,
      resolved: result.status === "completed",
      contextType: "general",
      serviceTags: [],
    });

    return {
      execution,
      requiresApproval: result.requiresApproval,
      message: result.requiresApproval
        ? "Action requires approval before execution"
        : "Action execution started",
    };
  }
}
