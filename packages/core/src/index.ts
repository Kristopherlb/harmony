/**
 * packages/core/src/index.ts
 * Entry point for the Core package.
 */
export * from './binders/oauth-broker.js';
export * from './binders/flag-provider.js';
export * from './types.js';

// Context exports
export {
  goldenContextSchema,
  parseGoldenContext,
  hasIncidentContext,
  extractIncidentFields,
  DATA_CLASSIFICATION,
  INCIDENT_SEVERITY,
  type GoldenContext,
  type DataClassification,
  type IncidentSeverity,
} from './context/golden-context.js';

export {
  generateIncidentId,
  createIncidentGoldenContext,
  extractIncidentContext,
  updateIncidentContext,
  generateIncidentChannelName,
  buildIncidentSummary,
  isHighPriority,
  getApprovalTimeoutForSeverity,
  type IncidentContext,
  type IncidentIdOptions,
} from './context/incident-context.js';

// OCS exports
export type { Capability } from './ocs/capability.js';
export type { CapabilityContext, ErrorCategory } from './types.js';

// Observability exports (GOS-001)
export { withGoldenSpan, getGoldenSpanAttributes, GOLDEN_ATTRIBUTES } from './observability/golden-span.js';
