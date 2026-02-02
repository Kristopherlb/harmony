// server/actions/application/get-pending-approvals.ts
// Use case: Get pending approvals with RBAC

import type { ExecutionScope, UserRole, WorkflowExecution } from "../domain/types";
import type { ActionRepositoryPort, PermissionServicePort } from "./ports";

export interface GetPendingApprovalsRequest {
  role: UserRole;
  scope?: ExecutionScope;
}

export interface GetPendingApprovalsResponse {
  executions: WorkflowExecution[];
  total: number;
}

export class GetPendingApprovals {
  constructor(
    private actionRepository: ActionRepositoryPort,
    private permissionService: PermissionServicePort
  ) {}

  async execute(request: GetPendingApprovalsRequest): Promise<GetPendingApprovalsResponse> {
    if (!this.permissionService.canApprove(request.role)) {
      throw new Error("Insufficient permissions to view approvals");
    }

    const executions = await this.actionRepository.getPendingApprovals(request.scope);
    return { executions, total: executions.length };
  }
}
