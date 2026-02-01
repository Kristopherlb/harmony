/**
 * packages/core/src/types.ts
 * Phase 2 public API: shared types (OCS/WCS/ASS).
 */
import type { GoldenContext } from './context/golden-context.js';

/** Standard error categories for Temporal retry and observability (OCS). */
export type ErrorCategory =
  | 'RETRYABLE'
  | 'FATAL'
  | 'AUTH_FAILURE'
  | 'RATE_LIMIT';

/** Context passed into capability factory: config + secret refs only (no raw secrets). */
export interface CapabilityContext<Config = unknown, Secrets = unknown> {
  ctx: GoldenContext;
  config: Config;
  secretRefs: Secrets;
}

/** Saga compensation: runs on workflow failure, LIFO order (WCS). */
export type CompensationFn = () => Promise<void>;

/** MCP tool identifier (ASS). */
export type ToolId = string;
