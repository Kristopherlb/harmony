/**
 * packages/capabilities/src/demo/echo.capability.ts
 * Demo OCS capability executed via Dagger container.
 *
 * Convention: container prints JSON output to stdout (single line).
 */
import { z } from '@golden/schema-registry';
import type { Capability, CapabilityContext } from '@golden/core';

const inputSchema = z.object({ x: z.number() });
const outputSchema = z.object({ y: z.number() });
const configSchema = z.object({});
const secretsSchema = z.object({});

export type EchoInput = z.infer<typeof inputSchema>;
export type EchoOutput = z.infer<typeof outputSchema>;
export type EchoConfig = z.infer<typeof configSchema>;
export type EchoSecrets = z.infer<typeof secretsSchema>;

const echoCapabilityImpl: Capability<EchoInput, EchoOutput, EchoConfig, EchoSecrets> = {
  metadata: {
    id: 'golden.echo',
    version: '1.0.0',
    name: 'Echo',
    description: 'Echo input.x to output.y (Dagger container JSON stdout).',
    tags: ['demo', 'test'],
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
    dataClassification: 'PUBLIC',
    networkAccess: { allowOutbound: [] },
  },
  operations: {
    isIdempotent: true,
    retryPolicy: { maxAttempts: 1, initialIntervalSeconds: 1, backoffCoefficient: 1 },
    errorMap: () => 'FATAL',
    costFactor: 'LOW',
  },
  aiHints: { exampleInput: { x: 1 }, exampleOutput: { y: 1 } },
  factory: (dag, context: CapabilityContext<EchoConfig, EchoSecrets>, input: EchoInput) => {
    void context;
    type ContainerBuilder = {
      from(image: string): ContainerBuilder;
      withEnvVariable(key: string, value: string): ContainerBuilder;
      withExec(args: string[]): unknown;
    };
    type DaggerClient = { container(): ContainerBuilder };
    const d = dag as unknown as DaggerClient;
    return d
      .container()
      .from('node:20-alpine')
      .withEnvVariable('X', String(input.x))
      .withExec(['node', '-e', "const x=Number(process.env.X); process.stdout.write(JSON.stringify({y:x}));"]);
  },
};

export { echoCapabilityImpl as echoCapability };

