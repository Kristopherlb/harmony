// server/actions/application/approve-or-reject-action.ts
// Use case: Approve or reject a pending action execution

import type { UserRole } from "../domain/types";
import type { ActionRepositoryPort, WorkflowEnginePort, PermissionServicePort, EventIngestionPort } from "./ports";

export interface ApproveOrRejectActionRequest {
  executionId: string;
  action: "approve" | "reject";
  comment?: string;
  userId: string;
  username: string;
  role: UserRole;
}

export interface ApproveOrRejectActionResponse {
  success: boolean;
  action: "approve" | "reject";
  executionId: string;
}

export class ApproveOrRejectAction {
  constructor(
    private actionRepository: ActionRepositoryPort,
    private workflowEngine: WorkflowEnginePort,
    private permissionService: PermissionServicePort,
    private eventIngestion: EventIngestionPort
  ) {}

  async execute(request: ApproveOrRejectActionRequest): Promise<ApproveOrRejectActionResponse> {
    if (!this.permissionService.canApprove(request.role)) {
      throw new Error("Insufficient permissions to approve actions");
    }

    const execution = await this.actionRepository.getExecution(request.executionId);
    if (!execution) {
      throw new Error("Execution not found");
    }

    if (execution.status !== "pending_approval") {
      throw new Error("Execution is not pending approval");
    }

    let success: boolean;
    if (request.action === "approve") {
      success = await this.workflowEngine.approveWorkflow(execution.runId, request.userId);
      if (success) {
        await this.actionRepository.updateExecution(request.executionId, {
          status: "running",
          approvedBy: request.userId,
          approvedAt: new Date(),
        });
      }
    } else {
      success = await this.workflowEngine.rejectWorkflow(execution.runId, request.userId, request.comment);
      if (success) {
        await this.actionRepository.updateExecution(request.executionId, {
          status: "rejected",
          approvedBy: request.userId,
          approvedAt: new Date(),
        });
      }
    }

    if (!success) {
      throw new Error("Failed to process approval");
    }

    await this.eventIngestion.createEvent({
      timestamp: new Date().toISOString(),
      source: "slack",
      type: request.action === "approve" ? "decision" : "log",
      payload: {
        actionType: "workflow_approval",
        executionId: request.executionId,
        runId: execution.runId,
        action: request.action,
        comment: request.comment,
        context: execution.context ?? {},
      },
      severity: "medium",
      userId: request.userId,
      username: request.username,
      message: `Action ${request.action === "approve" ? "Approved" : "Rejected"}: ${execution.actionName}`,
      resolved: true,
      resolvedAt: new Date().toISOString(),
      contextType: execution.context?.contextType ?? "general",
      serviceTags: execution.context?.serviceTags ?? [],
    });

    return {
      success: true,
      action: request.action,
      executionId: request.executionId,
    };
  }
}
