/**
 * packages/capabilities/src/connectors/github-graphql-query.capability.ts
 * Generated OCS capability (connector) (GSS-001 / OCS-001).
 *
 * TODO: Replace placeholder schemas and factory.
 */
import { z } from '@golden/schema-registry';
import type { Capability, CapabilityContext } from '@golden/core';

const inputSchema = z
  .object({
    query: z.string().optional().describe('GraphQL query string.'),
    variables: z.record(z.unknown()).optional().describe('GraphQL variables.'),
  })
  .describe('githubGraphqlQueryCapability input');
const outputSchema = z.record(z.unknown()).describe('githubGraphqlQueryCapability output');
const configSchema = z.object({}).describe('githubGraphqlQueryCapability config');
const secretsSchema = z.object({}).describe('githubGraphqlQueryCapability secrets (keys only)');

export type githubGraphqlQueryInput = z.infer<typeof inputSchema>;
export type githubGraphqlQueryOutput = z.infer<typeof outputSchema>;
export type githubGraphqlQueryConfig = z.infer<typeof configSchema>;
export type githubGraphqlQuerySecrets = z.infer<typeof secretsSchema>;

export const githubGraphqlQueryCapability: Capability<githubGraphqlQueryInput, githubGraphqlQueryOutput, githubGraphqlQueryConfig, githubGraphqlQuerySecrets> = {
  metadata: {
    id: 'golden.github.graphql.query',
    version: '1.0.0',
    name: 'githubGraphqlQuery',
    description: 'TODO: Describe what this capability does (purpose, not effect).',
    tags: ['generated', 'connector'],
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
    networkAccess: {
      // Explicit allowOutbound required by OCS/ISS (can be empty, but must be explicit).
      allowOutbound: [],
    },
  },
  operations: {
    isIdempotent: true,
    retryPolicy: { maxAttempts: 1, initialIntervalSeconds: 1, backoffCoefficient: 1 },
    errorMap: () => 'FATAL',
    costFactor: 'LOW',
  },
  aiHints: { exampleInput: {}, exampleOutput: {} },
  factory: (dag, context: CapabilityContext<githubGraphqlQueryConfig, githubGraphqlQuerySecrets>, input: githubGraphqlQueryInput) => {
    void context;
    const token = (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env?.GITHUB_TOKEN;
    if (!token) {
      throw new Error('GITHUB_TOKEN is required');
    }
    // Dagger client is provided by the worker at runtime.
    type ContainerBuilder = {
      from(image: string): ContainerBuilder;
      withEnvVariable(key: string, value: string): ContainerBuilder;
      withExec(args: string[]): unknown;
    };
    type DaggerClient = { container(): ContainerBuilder };
    const d = dag as unknown as DaggerClient;
    const payload = {
      query: input?.query ?? '',
      variables: input?.variables ?? {},
    };
    return d
      .container()
      .from('node:20-alpine')
      .withEnvVariable('GITHUB_TOKEN', token)
      .withEnvVariable('INPUT_JSON', JSON.stringify(payload))
      .withExec([
      'node',
      '-e',
      'process.stdout.write(JSON.stringify({}))',
    ]);
  },
};
