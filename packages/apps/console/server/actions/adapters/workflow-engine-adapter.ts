// server/actions/adapters/workflow-engine-adapter.ts
// Adapter: Adapts IWorkflowEngine to WorkflowEnginePort with domain mapping

import type { IWorkflowEngine } from "../../workflow-engine";
import type { WorkflowEnginePort } from "../application/ports";
import type { Action, ExecuteActionRequest } from "../domain/types";
import { toSharedAction, toSharedExecuteActionRequest } from "../domain/mappers";

export class WorkflowEngineAdapter implements WorkflowEnginePort {
  constructor(private engine: IWorkflowEngine) {}

  async startWorkflow(action: Action, request: ExecuteActionRequest, userId: string, username: string) {
    // Convert domain types to shared types for the engine (which still uses shared types)
    const sharedAction = toSharedAction(action);
    const sharedRequest = toSharedExecuteActionRequest(request);
    return this.engine.startWorkflow(sharedAction, sharedRequest, userId, username);
  }

  async getWorkflowStatus(runId: string) {
    return this.engine.getWorkflowStatus(runId);
  }

  async cancelWorkflow(runId: string) {
    return this.engine.cancelWorkflow(runId);
  }

  async approveWorkflow(runId: string, approverId: string) {
    return this.engine.approveWorkflow(runId, approverId);
  }

  async rejectWorkflow(runId: string, approverId: string, reason?: string) {
    return this.engine.rejectWorkflow(runId, approverId, reason);
  }
}
