/**
 * packages/capabilities/src/demo/secret-present.capability.ts
 *
 * Purpose: Runtime smoke helper capability that proves a secret was mounted
 * into the container via ISS-001 secretRefs, without printing the secret value.
 */
import { z } from '@golden/schema-registry';
import type { Capability, CapabilityContext } from '@golden/core';

const inputSchema = z.object({}).describe('secretPresent input');
const outputSchema = z.object({ ok: z.boolean() }).describe('secretPresent output');
const configSchema = z.object({}).describe('secretPresent config');
const secretsSchema = z
  .object({
    value: z.string().describe('Secret ref/path for smoke (resolved to a Dagger Secret at runtime).'),
  })
  .describe('secretPresent secrets (keys only)');

export type SecretPresentInput = z.infer<typeof inputSchema>;
export type SecretPresentOutput = z.infer<typeof outputSchema>;
export type SecretPresentConfig = z.infer<typeof configSchema>;
export type SecretPresentSecrets = z.infer<typeof secretsSchema>;

export const secretPresentCapability: Capability<
  SecretPresentInput,
  SecretPresentOutput,
  SecretPresentConfig,
  SecretPresentSecrets
> = {
  metadata: {
    id: 'golden.demo.secret-present',
    version: '1.0.0',
    name: 'secretPresent',
    description:
      'Proves a secretRef was resolved and mounted into the runtime container without leaking the secret value. Use for runtime-smoke validation of OpenBao secretRefs.',
    domain: 'demo',
    tags: ['demo', 'smoke', 'secrets'],
    maintainer: 'platform',
  },
  schemas: {
    input: inputSchema,
    output: outputSchema,
    config: configSchema,
    secrets: secretsSchema,
  },
  security: {
    requiredScopes: [],
    dataClassification: 'INTERNAL',
    networkAccess: { allowOutbound: [] },
  },
  operations: {
    isIdempotent: true,
    retryPolicy: { maxAttempts: 1, initialIntervalSeconds: 1, backoffCoefficient: 1 },
    errorMap: () => 'FATAL',
    costFactor: 'LOW',
  },
  aiHints: {
    exampleInput: {},
    exampleOutput: { ok: true },
    usageNotes:
      'Provide `secretRefs.value` as an absolute OpenBao path (e.g. /artifacts/console/public/secrets/engine_mvp.smoke). The worker resolves it to a Dagger secret and mounts it at /run/secrets/value.',
  },
  factory: (
    dag,
    context: CapabilityContext<SecretPresentConfig, SecretPresentSecrets>,
    _input: SecretPresentInput
  ) => {
    void _input;
    type ContainerBuilder = {
      from(image: string): ContainerBuilder;
      withMountedSecret?(path: string, secret: unknown): ContainerBuilder;
      withExec(args: string[]): unknown;
    };
    type DaggerClient = { container(): ContainerBuilder };
    const d = dag as unknown as DaggerClient;

    let c = d.container().from('node:20-alpine');

    if (typeof (c as any).withMountedSecret === 'function') {
      c = c.withMountedSecret!('/run/secrets/value', (context.secretRefs as any).value);
    }

    return c.withExec([
      'node',
      '-e',
      [
        'const fs = require("node:fs");',
        'const p="/run/secrets/value";',
        'const v = fs.readFileSync(p, "utf8");',
        'if (!v || String(v).trim().length === 0) {',
        '  throw new Error("SECRET_MISSING");',
        '}',
        'process.stdout.write(JSON.stringify({ ok: true }));',
      ].join(''),
    ]);
  },
};

