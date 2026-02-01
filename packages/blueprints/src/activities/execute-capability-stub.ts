/**
 * Stub implementation of executeDaggerCapability for e2e (Metric 1).
 * Worker registers this; no custom activity code per capability.
 */
import { wrapExecuteDaggerCapability } from '@golden/core';
import type { ExecuteCapabilityActivityInput } from '@golden/core';

const ECHO_CAP_ID = 'golden.echo';

async function _executeDaggerCapability<In, Out>(
  input: ExecuteCapabilityActivityInput<In>
): Promise<Out> {
  if (input.capId === ECHO_CAP_ID) {
    const inp = input.input as { x: number };
    return { y: inp.x } as Out;
  }
  throw new Error(`Unknown capability: ${input.capId}`);
}

export const executeDaggerCapability = wrapExecuteDaggerCapability(_executeDaggerCapability);
