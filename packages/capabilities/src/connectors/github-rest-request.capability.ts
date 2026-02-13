/**
 * packages/capabilities/src/connectors/github-rest-request.capability.ts
 * GitHub REST request capability (OCS connector).
 *
 * Purpose: make a GitHub REST API request using an ISS-001 mounted token secret
 * and an explicit outbound allowlist.
 */
import { z } from '@golden/schema-registry';
import type { Capability, CapabilityContext } from '@golden/core';
import { GITHUB_HTTP_RUNTIME_CJS } from './github-runtime.js';

const inputSchema = z
  .object({
    method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).describe('HTTP method for GitHub REST request.'),
    path: z.string().min(1).describe('GitHub REST path (e.g. /repos/{owner}/{repo}).'),
    query: z.record(z.union([z.string(), z.number(), z.boolean()])).optional().describe('Query parameters.'),
    body: z.unknown().optional().describe('Request body (JSON).'),
  })
  .describe('githubRestRequestCapability input');
const outputSchema = z
  .object({
    status: z.number().describe('HTTP status code'),
    headers: z.record(z.string()).describe('Response headers'),
    body: z.unknown().describe('Parsed JSON body (or {text} wrapper for non-JSON)'),
  })
  .describe('githubRestRequestCapability output');
const configSchema = z
  .object({
    baseUrl: z.string().url().optional().describe('GitHub API base URL (default: https://api.github.com)'),
  })
  .describe('githubRestRequestCapability config');
const secretsSchema = z
  .object({
    token: z.string().describe('Secret ref/path for GitHub token (Bearer)'),
  })
  .describe('githubRestRequestCapability secrets (keys only)');

export type githubRestRequestInput = z.infer<typeof inputSchema>;
export type githubRestRequestOutput = z.infer<typeof outputSchema>;
export type githubRestRequestConfig = z.infer<typeof configSchema>;
export type githubRestRequestSecrets = z.infer<typeof secretsSchema>;

export const githubRestRequestCapability: Capability<githubRestRequestInput, githubRestRequestOutput, githubRestRequestConfig, githubRestRequestSecrets> = {
  metadata: {
    id: 'golden.github.rest.request',
    domain: 'github',
    version: '1.0.0',
    name: 'githubRestRequest',
    description:
      'Perform a GitHub REST API request using a mounted token secret and an explicit outbound allowlist. Use for safe, composable GitHub automation.',
    tags: ['connector', 'github', 'rest'],
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
    exampleInput: {
      method: 'GET',
      path: '/repos/octocat/hello-world',
      query: { per_page: 1 },
    },
    exampleOutput: { status: 200, headers: {}, body: {} },
    usageNotes:
      'Provide a token via `secretRefs.token` (an OpenBao path). The worker resolves and mounts it; the container reads /run/secrets/github_token.',
  },
  factory: (dag, context: CapabilityContext<githubRestRequestConfig, githubRestRequestSecrets>, input: githubRestRequestInput) => {
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
      mode: 'rest',
      baseUrl: context.config.baseUrl ?? 'https://api.github.com',
      allowOutbound: githubRestRequestCapability.security.networkAccess.allowOutbound,
      method: input.method,
      path: input.path,
      query: input.query ?? {},
      body: input.body ?? undefined,
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
