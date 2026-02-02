// server/actions/application/get-executions.ts
// Use case: Get recent executions

import type { ExecutionScope, WorkflowExecution } from "../domain/types";
import type { ActionRepositoryPort } from "./ports";

export interface GetExecutionsRequest {
  limit?: number;
  scope?: ExecutionScope;
}

export interface GetExecutionsResponse {
  executions: WorkflowExecution[];
  total: number;
}

export class GetExecutions {
  constructor(private actionRepository: ActionRepositoryPort) {}

  async execute(request: GetExecutionsRequest): Promise<GetExecutionsResponse> {
    const limit = request.limit ?? 20;
    const executions = await this.actionRepository.getRecentExecutions(limit, request.scope);
    return { executions, total: executions.length };
  }
}
