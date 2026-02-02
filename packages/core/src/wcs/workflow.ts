/**
 * Workflow-only entry point for Temporal bundle (no LangGraph/OTel/Node-heavy deps).
 */
export {
  BaseBlueprint,
  SECURITY_CONTEXT_MEMO_KEY,
  GOLDEN_CONTEXT_MEMO_KEY,
  CapabilityDisabledError,
  type ExecuteCapabilityActivity,
  type FlagActivity,
  type EvaluateFlagActivityInput,
  type ApprovalNotificationActivity,
} from './base-blueprint.js';
export type { SecurityContext } from './security-context.js';
export type { ExecuteCapabilityActivityInput } from './execute-capability-activity.js';
export { createSagaManager, type SagaManager } from './saga-manager.js';
export type { Capability } from '../ocs/capability.js';

// Approval signal types (HITL infrastructure)
export {
  approvalSignal,
  approvalStateQuery,
  ApprovalTimeoutError,
  ApprovalRejectedError,
  createApprovalBlocks,
  createApprovalResultBlocks,
  APPROVAL_ACTION_IDS,
  type ApprovalDecision,
  type ApprovalSignalPayload,
  type ApprovalState,
  type ApprovalRequestParams,
  type ApprovalResult,
  type ApprovalStatus,
} from './approval-signal.js';
