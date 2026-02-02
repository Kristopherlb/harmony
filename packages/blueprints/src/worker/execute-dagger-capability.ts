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
import { resolveSecretRefs } from './secret-broker.js';

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
  const config = cap.schemas.config.parse((input as { config?: unknown }).config ?? {}) as unknown;
  const secretRefs = cap.schemas.secrets.parse((input as { secretRefs?: unknown }).secretRefs ?? {}) as unknown;

  // Dynamic import keeps this file compatible with NodeNext/CJS compilation.
  const { connection, dag } = await import('@dagger.io/dagger');
  let stdout = '';
  await connection(
    async () => {
      const openBao = {
        address:
          (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env
            ?.BAO_ADDR ??
          (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env
            ?.VAULT_ADDR ??
          'http://localhost:8200',
        token:
          (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env
            ?.BAO_TOKEN ??
          (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env
            ?.VAULT_TOKEN ??
          'root',
        mount:
          (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env
            ?.BAO_KV_MOUNT ?? 'secret',
      };

      const resolvedSecretRefs = await resolveSecretRefs({
        dag: dag as unknown,
        appId: input.ctx?.app_id ?? 'app',
        secretRefs: secretRefs as unknown as Record<string, unknown>,
        openBao,
      });

      const container = cap.factory(
        dag as unknown,
        { ctx: input.ctx!, config: config as unknown, secretRefs: resolvedSecretRefs as unknown },
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

