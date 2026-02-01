// server/actions/application/get-workflow-status.ts
// Use case: Get workflow execution status

import type { WorkflowStatus } from "../domain/types";
import type { WorkflowEnginePort } from "./ports";

export interface GetWorkflowStatusRequest {
  runId: string;
}

export interface GetWorkflowStatusResponse {
  runId: string;
  status: WorkflowStatus;
  output: string[];
  error?: string;
}

export class GetWorkflowStatus {
  constructor(private workflowEngine: WorkflowEnginePort) {}

  async execute(request: GetWorkflowStatusRequest): Promise<GetWorkflowStatusResponse | null> {
    const status = await this.workflowEngine.getWorkflowStatus(request.runId);
    return status;
  }
}
