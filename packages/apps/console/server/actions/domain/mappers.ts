// server/actions/domain/mappers.ts
// Mappers: shared/contract DTO ↔ domain model

import type {
  Action as SharedAction,
  WorkflowExecution as SharedWorkflowExecution,
  ExecuteActionRequest as SharedExecuteActionRequest,
  WorkflowStatus,
} from "@shared/schema";
import type { Action, WorkflowExecution, ExecuteActionRequest } from "./types";

/**
 * Convert shared/contract Action to domain Action
 */
export function toDomainAction(shared: SharedAction): Action {
  return {
    id: shared.id,
    name: shared.name,
    description: shared.description,
    category: shared.category,
    riskLevel: shared.riskLevel,
    requiredParams: shared.requiredParams,
    workflowId: shared.workflowId,
    icon: shared.icon,
    estimatedDuration: shared.estimatedDuration,
    requiredRoles: shared.requiredRoles,
    targetServices: shared.targetServices,
    contextTypes: shared.contextTypes,
  };
}

/**
 * Convert domain Action to shared/contract Action
 */
export function toSharedAction(domain: Action): SharedAction {
  return {
    id: domain.id,
    name: domain.name,
    description: domain.description,
    category: domain.category,
    riskLevel: domain.riskLevel,
    requiredParams: domain.requiredParams,
    workflowId: domain.workflowId,
    icon: domain.icon,
    estimatedDuration: domain.estimatedDuration,
    requiredRoles: domain.requiredRoles,
    targetServices: domain.targetServices,
    contextTypes: domain.contextTypes,
  };
}

/**
 * Convert shared/contract WorkflowExecution to domain WorkflowExecution
 */
export function toDomainWorkflowExecution(shared: SharedWorkflowExecution): WorkflowExecution {
  return {
    id: shared.id,
    runId: shared.runId,
    actionId: shared.actionId,
    actionName: shared.actionName,
    status: shared.status,
    params: shared.params,
    reasoning: shared.reasoning,
    executedBy: shared.executedBy,
    executedByUsername: shared.executedByUsername,
    startedAt: new Date(shared.startedAt),
    completedAt: shared.completedAt ? new Date(shared.completedAt) : undefined,
    approvedBy: shared.approvedBy,
    approvedAt: shared.approvedAt ? new Date(shared.approvedAt) : undefined,
    output: shared.output,
    error: shared.error,
  };
}

/**
 * Convert domain WorkflowExecution to shared/contract WorkflowExecution
 */
export function toSharedWorkflowExecution(domain: WorkflowExecution): SharedWorkflowExecution {
  return {
    id: domain.id,
    runId: domain.runId,
    actionId: domain.actionId,
    actionName: domain.actionName,
    status: domain.status,
    params: domain.params,
    reasoning: domain.reasoning,
    executedBy: domain.executedBy,
    executedByUsername: domain.executedByUsername,
    startedAt: domain.startedAt.toISOString(),
    completedAt: domain.completedAt?.toISOString(),
    approvedBy: domain.approvedBy,
    approvedAt: domain.approvedAt?.toISOString(),
    output: domain.output,
    error: domain.error,
  };
}

/**
 * Convert shared/contract ExecuteActionRequest to domain ExecuteActionRequest
 */
export function toDomainExecuteActionRequest(shared: SharedExecuteActionRequest): ExecuteActionRequest {
  return {
    actionId: shared.actionId,
    params: shared.params,
    reasoning: shared.reasoning,
  };
}

/**
 * Convert domain ExecuteActionRequest to shared/contract ExecuteActionRequest
 */
export function toSharedExecuteActionRequest(domain: ExecuteActionRequest): SharedExecuteActionRequest {
  return {
    actionId: domain.actionId,
    params: domain.params,
    reasoning: domain.reasoning,
  };
}
