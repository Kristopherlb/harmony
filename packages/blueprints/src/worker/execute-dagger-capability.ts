/**
 * packages/blueprints/src/worker/execute-dagger-capability.ts
 * Real ExecuteCapability activity implementation:
 * - resolve capId to Capability
 * - validate input/output (Zod)
 * - execute Dagger container and parse JSON stdout
 * - wrap with golden-span if ctx is present
 */
import type { ExecuteCapabilityActivityInput } from '@golden/core';
import { wrapExecuteDaggerCapability } from '@golden/core';
import { createCapabilityRegistry, getCapability } from '@golden/capabilities';

async function _executeDaggerCapability<In, Out>(
  input: ExecuteCapabilityActivityInput<In>
): Promise<Out> {
  if (!input.ctx) {
    throw new Error('GoldenContext (input.ctx) is required for capability execution');
  }
  const enable = (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env
    ?.ENABLE_DAGGER_E2E;
  if (enable !== '1') {
    throw new Error('DAGGER_E2E_DISABLED (set ENABLE_DAGGER_E2E=1 to run container execution)');
  }

  const registry = createCapabilityRegistry();
  const cap = getCapability(registry, input.capId);

  const parsedIn = cap.schemas.input.parse(input.input) as unknown as In;
  const config = cap.schemas.config.parse((input as any).config ?? {}) as unknown;
  const secretRefs = cap.schemas.secrets.parse((input as any).secretRefs ?? {}) as unknown;

  // Dynamic import keeps this file compatible with NodeNext/CJS compilation.
  const { connection, dag } = await import('@dagger.io/dagger');
  let stdout = '';
  await connection(
    async () => {
      const container = cap.factory(
        dag as unknown,
        { ctx: input.ctx!, config: config as unknown, secretRefs: secretRefs as unknown },
        parsedIn
      ) as unknown;
      const maybe = container as { stdout?: unknown };
      if (typeof maybe.stdout !== 'function') {
        throw new Error('Capability factory did not return a runnable container');
      }
      stdout = await (maybe.stdout as () => Promise<string>)();
    },
    {}
  );

  let json: unknown;
  try {
    json = JSON.parse(stdout);
  } catch {
    throw new Error(`Capability stdout was not valid JSON: ${stdout}`);
  }
  const parsedOut = cap.schemas.output.parse(json) as Out;
  return parsedOut;
}

export const executeDaggerCapability = wrapExecuteDaggerCapability(_executeDaggerCapability);

