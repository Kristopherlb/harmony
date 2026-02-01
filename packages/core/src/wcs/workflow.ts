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
} from './base-blueprint.js';
export type { SecurityContext } from './security-context.js';
export type { ExecuteCapabilityActivityInput } from './execute-capability-activity.js';
export { createSagaManager, type SagaManager } from './saga-manager.js';
export type { Capability } from '../ocs/capability.js';
