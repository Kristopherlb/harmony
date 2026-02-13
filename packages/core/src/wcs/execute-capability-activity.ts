/**
 * packages/core/src/wcs/execute-capability-activity.ts
 * Activity signature for generic ExecuteCapability (WCS). Worker implements this.
 */
import type { GoldenContext } from '../context/golden-context.js';
/** Input for the platform executeCapability activity (identity propagation). */
export interface ExecuteCapabilityActivityInput<In = unknown> {
  capId: string;
  input: In;
  /** Optional config object passed to the capability's config schema at execution time. */
  config?: unknown;
  /** Optional secretRefs object passed to the capability's secrets schema at execution time. */
  secretRefs?: unknown;
  /**
   * Optional correlation metadata for UI/execution mapping.
   * This must not be required by capability implementations.
   */
  correlation?: {
    nodeId: string;
  };
  runAs: string;
  traceId?: string;
  /** Optional GoldenContext for observability and binders (preferred). */
  ctx?: GoldenContext;
}
