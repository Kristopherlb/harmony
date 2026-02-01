/**
 * packages/core/src/observability/execute-capability-instrumentation.ts
 * Activity-layer instrumentation for ExecuteCapability (GOS-001).
 */
import type { ExecuteCapabilityActivityInput } from '../wcs/execute-capability-activity.js';
import { withGoldenSpan } from './golden-span.js';

/**
 * Wrap an executeDaggerCapability handler with OTel span injection when a GoldenContext is provided.
 * Safe to use even when no tracer provider is configured (no-op spans).
 */
export function wrapExecuteDaggerCapability<In, Out>(
  handler: (input: ExecuteCapabilityActivityInput<In>) => Promise<Out>
): (input: ExecuteCapabilityActivityInput<In>) => Promise<Out> {
  return async (input) => {
    if (!input.ctx) return handler(input);
    return withGoldenSpan(
      'capability.execute',
      input.ctx,
      'EXECUTABLE',
      async () => handler(input)
    );
  };
}

