/**
 * @golden/core
 * Phase 2 SDK: shared types, OCS/WCS/ASS contracts, binders.
 */

// Shared types (Phase 2 Section 2.0)
export type {
  ErrorCategory,
  CapabilityContext,
  CompensationFn,
  ToolId,
} from './src/types.js';
export {
  goldenContextSchema,
  parseGoldenContext,
  DATA_CLASSIFICATION,
  type GoldenContext,
  type DataClassification,
} from './src/context/golden-context.js';

// OCS
export type { Capability, DaggerContainer } from './src/ocs/capability.js';
export type { NormalizedError } from './src/ocs/error-normalizer.js';
export { normalizeError } from './src/ocs/error-normalizer.js';
export { BaseCapability } from './src/ocs/base-capability.js';

// Binders (ISS-001)
export {
  buildOpenBaoPath,
  createSecretBroker,
  type SecretBroker,
  type SecretMountConfig,
  type SecretResolver,
  type SecretScope,
} from './src/binders/secret-broker.js';
export {
  noopContextInjector,
  type ContextInjector,
  type EnrichedContext,
} from './src/binders/context-injector.js';

// Observability (GOS-001)
export {
  getGoldenSpanAttributes,
  withGoldenSpan,
  GOLDEN_ATTRIBUTES,
  type GoldenComponentType,
} from './src/observability/golden-span.js';
export { wrapExecuteDaggerCapability } from './src/observability/execute-capability-instrumentation.js';

// FinOps (Phase 6 Day 2)
export {
  calculateRunCost,
  type ComputeUsage,
  type IntelligenceUsage,
  type RunCostBreakdown,
  type RunCostInput,
  type RunCostResult,
} from './src/finops/cost-analyzer.js';

// WCS
export {
  BaseBlueprint,
  SECURITY_CONTEXT_MEMO_KEY,
  type ExecuteCapabilityActivity,
} from './src/wcs/base-blueprint.js';
export type { SecurityContext } from './src/wcs/security-context.js';
export type { ExecuteCapabilityActivityInput } from './src/wcs/execute-capability-activity.js';
export { createSagaManager, type SagaManager } from './src/wcs/saga-manager.js';

// ASS / AIP
export {
  GoldenPathState,
  type GoldenPathStateType,
  type ArtifactEntry,
  type PendingAction,
  goldenPathStateSchema,
  artifactEntrySchema,
  pendingActionSchema,
} from './src/ass/golden-path-state.js';
export type { AgentSpec } from './src/ass/agent-spec.js';
export {
  discoverTools,
  type ToolRegistry,
  type ToolFn,
} from './src/ass/discover-tools.js';
export {
  checkIterationGuardrail,
  checkTokenGuardrail,
  checkRestrictedToolGuardrail,
  type GuardrailOptions,
  type GuardrailResult,
} from './src/ass/guardrails.js';

// Workbench (security-sensitive transport contracts)
export {
  createWorkbenchSessionRequestSchema,
  createWorkbenchSessionResponseSchema,
  httpMethodSchema,
  workbenchGraphqlProxyRequestSchema,
  workbenchGraphqlProxyResponseSchema,
  workbenchKindSchema,
  workbenchModeSchema,
  workbenchProviderSchema,
  workbenchRbacSnapshotSchema,
  workbenchRestProxyRequestSchema,
  workbenchRestProxyResponseSchema,
  type CreateWorkbenchSessionRequest,
  type CreateWorkbenchSessionResponse,
  type HttpMethod,
  type WorkbenchGraphqlProxyRequest,
  type WorkbenchGraphqlProxyResponse,
  type WorkbenchKind,
  type WorkbenchMode,
  type WorkbenchProvider,
  type WorkbenchRbacSnapshot,
  type WorkbenchRestProxyRequest,
  type WorkbenchRestProxyResponse,
} from './src/workbench/workbench-contracts.js';
