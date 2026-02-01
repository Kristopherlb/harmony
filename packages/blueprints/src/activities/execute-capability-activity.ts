/**
 * Explicit STUB for unit tests / demos (Potemkin-safe by being labeled and not used by workers).
 *
 * - Returns `{ y: x }` for `golden.echo`
 * - Throws for any other `capId`
 *
 * Real workers should provide their own implementation that resolves and runs capabilities
 * (see `src/worker/execute-dagger-capability.ts`).
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
