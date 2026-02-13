/**
 * packages/capabilities/src/connectors/github-graphql-query.capability.ts
 * GitHub GraphQL query capability (OCS connector).
 *
 * Purpose: execute a GitHub GraphQL query using an ISS-001 mounted token secret
 * and an explicit outbound allowlist.
 */
import { z } from '@golden/schema-registry';
import type { Capability, CapabilityContext } from '@golden/core';
import { GITHUB_HTTP_RUNTIME_CJS } from './github-runtime.js';

const inputSchema = z
  .object({
    query: z.string().min(1).describe('GraphQL query string.'),
    variables: z.record(z.unknown()).optional().describe('GraphQL variables.'),
  })
  .describe('githubGraphqlQueryCapability input');
const outputSchema = z
  .object({
    status: z.number().describe('HTTP status code'),
    headers: z.record(z.string()).describe('Response headers'),
    body: z.unknown().describe('Parsed JSON body (or {text} wrapper for non-JSON)'),
  })
  .describe('githubGraphqlQueryCapability output');
const configSchema = z
  .object({
    baseUrl: z.string().url().optional().describe('GitHub API base URL (default: https://api.github.com)'),
  })
  .describe('githubGraphqlQueryCapability config');
const secretsSchema = z
  .object({
    token: z.string().describe('Secret ref/path for GitHub token (Bearer)'),
  })
  .describe('githubGraphqlQueryCapability secrets (keys only)');

export type githubGraphqlQueryInput = z.infer<typeof inputSchema>;
export type githubGraphqlQueryOutput = z.infer<typeof outputSchema>;
export type githubGraphqlQueryConfig = z.infer<typeof configSchema>;
export type githubGraphqlQuerySecrets = z.infer<typeof secretsSchema>;

export const githubGraphqlQueryCapability: Capability<githubGraphqlQueryInput, githubGraphqlQueryOutput, githubGraphqlQueryConfig, githubGraphqlQuerySecrets> = {
  metadata: {
    id: 'golden.github.graphql.query',
    domain: 'github',
    version: '1.0.0',
    name: 'githubGraphqlQuery',
    description:
      'Perform a GitHub GraphQL query using a mounted token secret and an explicit outbound allowlist. Use for safe, composable GitHub automation.',
    tags: ['connector', 'github', 'graphql'],
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
      allowOutbound: ['api.github.com'],
    },
  },
  operations: {
    isIdempotent: true,
    retryPolicy: { maxAttempts: 1, initialIntervalSeconds: 1, backoffCoefficient: 1 },
    errorMap: () => 'FATAL',
    costFactor: 'LOW',
  },
  aiHints: {
    exampleInput: { query: 'query { viewer { login } }', variables: {} },
    exampleOutput: { status: 200, headers: {}, body: {} },
    usageNotes:
      'Provide a token via `secretRefs.token` (an OpenBao path). The worker resolves and mounts it; the container reads /run/secrets/github_token.',
  },
  factory: (dag, context: CapabilityContext<githubGraphqlQueryConfig, githubGraphqlQuerySecrets>, input: githubGraphqlQueryInput) => {
    type ContainerBuilder = {
      from(image: string): ContainerBuilder;
      withEnvVariable(key: string, value: string): ContainerBuilder;
      withMountedSecret?(path: string, secret: unknown): ContainerBuilder;
      withNewFile?(path: string, contents: string): ContainerBuilder;
      withExec(args: string[]): unknown;
    };
    type DaggerClient = { container(): ContainerBuilder };
    const d = dag as unknown as DaggerClient;

    const payload = {
      mode: 'graphql',
      baseUrl: context.config.baseUrl ?? 'https://api.github.com',
      allowOutbound: githubGraphqlQueryCapability.security.networkAccess.allowOutbound,
      query: input.query,
      variables: input.variables ?? {},
    };

    let c = d.container().from('node:20-alpine').withEnvVariable('INPUT_JSON', JSON.stringify(payload));

    if (typeof (c as any).withMountedSecret === 'function') {
      c = c.withMountedSecret!('/run/secrets/github_token', (context.secretRefs as any).token);
    }
    if (typeof (c as any).withNewFile === 'function') {
      c = c.withNewFile!('/opt/github-runtime.cjs', GITHUB_HTTP_RUNTIME_CJS);
    }

    return c.withExec(['node', '/opt/github-runtime.cjs']);
  },
};
