/**
 * packages/capabilities/src/demo/math-add.capability.ts
 * Demo capability: add two numbers.
 */
import { z } from '@golden/schema-registry';
import type { Capability, CapabilityContext } from '@golden/core';

const inputSchema = z.object({ a: z.number(), b: z.number() });
const outputSchema = z.object({ sum: z.number() });
const configSchema = z.object({});
const secretsSchema = z.object({});

export type MathAddInput = z.infer<typeof inputSchema>;
export type MathAddOutput = z.infer<typeof outputSchema>;
export type MathAddConfig = z.infer<typeof configSchema>;
export type MathAddSecrets = z.infer<typeof secretsSchema>;

const mathAddCapabilityImpl: Capability<MathAddInput, MathAddOutput, MathAddConfig, MathAddSecrets> = {
  metadata: {
    id: 'golden.math_add',
    version: '1.0.0',
    name: 'Math Add',
    description: 'Add two numbers (a + b).',
    tags: ['demo', 'math'],
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
  aiHints: { exampleInput: { a: 2, b: 3 }, exampleOutput: { sum: 5 } },
  factory: (dag, context: CapabilityContext<MathAddConfig, MathAddSecrets>, input: MathAddInput) => {
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
      .withEnvVariable('A', String(input.a))
      .withEnvVariable('B', String(input.b))
      .withExec([
        'node',
        '-e',
        "const a=Number(process.env.A); const b=Number(process.env.B); process.stdout.write(JSON.stringify({sum:a+b}));",
      ]);
  },
};

export { mathAddCapabilityImpl as mathAddCapability };

