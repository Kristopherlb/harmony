/**
 * packages/capabilities/src/connectors/github-rest-request.capability.ts
 * Generated OCS capability (connector) (GSS-001 / OCS-001).
 *
 * TODO: Replace placeholder schemas and factory.
 */
import { z } from '@golden/schema-registry';
import type { Capability, CapabilityContext } from '@golden/core';

const inputSchema = z
  .object({
    method: z.string().optional().describe('HTTP method for GitHub REST request.'),
    path: z.string().optional().describe('GitHub REST path (e.g. /repos/{owner}/{repo}).'),
    query: z.record(z.union([z.string(), z.number(), z.boolean()])).optional().describe('Query parameters.'),
    body: z.unknown().optional().describe('Request body (JSON).'),
  })
  .describe('githubRestRequestCapability input');
const outputSchema = z.record(z.unknown()).describe('githubRestRequestCapability output');
const configSchema = z.object({}).describe('githubRestRequestCapability config');
const secretsSchema = z.object({}).describe('githubRestRequestCapability secrets (keys only)');

export type githubRestRequestInput = z.infer<typeof inputSchema>;
export type githubRestRequestOutput = z.infer<typeof outputSchema>;
export type githubRestRequestConfig = z.infer<typeof configSchema>;
export type githubRestRequestSecrets = z.infer<typeof secretsSchema>;

export const githubRestRequestCapability: Capability<githubRestRequestInput, githubRestRequestOutput, githubRestRequestConfig, githubRestRequestSecrets> = {
  metadata: {
    id: 'golden.github.rest.request',
    version: '1.0.0',
    name: 'githubRestRequest',
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
  factory: (dag, context: CapabilityContext<githubRestRequestConfig, githubRestRequestSecrets>, input: githubRestRequestInput) => {
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
      method: input?.method ?? 'GET',
      path: input?.path ?? '',
      query: input?.query ?? {},
      body: input?.body ?? null,
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
