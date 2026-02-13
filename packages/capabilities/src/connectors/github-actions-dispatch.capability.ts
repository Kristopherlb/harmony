/**
 * packages/capabilities/src/connectors/github-actions-dispatch.capability.ts
 *
 * Purpose: dispatch a GitHub Actions workflow (workflow_dispatch) in a narrowly-scoped,
 * composable way, using a mounted GitHub token secret (ISS-001) and explicit allowOutbound.
 */
import { z } from '@golden/schema-registry';
import type { Capability, CapabilityContext } from '@golden/core';
import { GITHUB_HTTP_RUNTIME_CJS } from './github-runtime.js';

const inputSchema = z
  .object({
    owner: z.string().min(1).describe('Repository owner/org.'),
    repo: z.string().min(1).describe('Repository name.'),
    workflow: z
      .string()
      .min(1)
      .describe('Workflow filename (e.g. ci.yml) or numeric workflow ID (as a string).'),
    ref: z.string().min(1).describe('Git ref to run on (e.g. main, refs/heads/main, or a tag).'),
    inputs: z.record(z.string()).optional().describe('workflow_dispatch inputs (string values).'),
  })
  .describe('githubActionsDispatchCapability input');

const outputSchema = z
  .object({
    status: z.number().describe('HTTP status code'),
    headers: z.record(z.string()).describe('Response headers'),
    body: z.unknown().describe('Parsed JSON body (or {text} wrapper for non-JSON)'),
  })
  .describe('githubActionsDispatchCapability output');

const configSchema = z
  .object({
    baseUrl: z.string().url().optional().describe('GitHub API base URL (default: https://api.github.com)'),
  })
  .describe('githubActionsDispatchCapability config');

const secretsSchema = z
  .object({
    token: z.string().describe('Secret ref/path for GitHub token (Bearer)'),
  })
  .describe('githubActionsDispatchCapability secrets (keys only)');

export type GithubActionsDispatchInput = z.infer<typeof inputSchema>;
export type GithubActionsDispatchOutput = z.infer<typeof outputSchema>;
export type GithubActionsDispatchConfig = z.infer<typeof configSchema>;
export type GithubActionsDispatchSecrets = z.infer<typeof secretsSchema>;

export const githubActionsDispatchCapability: Capability<
  GithubActionsDispatchInput,
  GithubActionsDispatchOutput,
  GithubActionsDispatchConfig,
  GithubActionsDispatchSecrets
> = {
  metadata: {
    id: 'golden.github.actions.dispatch',
    domain: 'github',
    version: '1.0.0',
    name: 'githubActionsDispatch',
    description:
      'Dispatch a GitHub Actions workflow via workflow_dispatch. Use for optional release orchestration (e.g., triggering CI/CD flows) with explicit outbound allowlists and token secretRefs.',
    tags: ['connector', 'github', 'actions', 'dispatch'],
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
      allowOutbound: ['api.github.com'],
    },
  },
  operations: {
    // Dispatch is a side-effect and not inherently idempotent.
    isIdempotent: false,
    retryPolicy: { maxAttempts: 1, initialIntervalSeconds: 1, backoffCoefficient: 1 },
    errorMap: () => 'FATAL',
    costFactor: 'LOW',
  },
  aiHints: {
    exampleInput: {
      owner: 'octocat',
      repo: 'hello-world',
      workflow: 'release.yml',
      ref: 'main',
      inputs: { version: 'v1.2.3' },
    },
    // GitHub returns 204 No Content on success.
    exampleOutput: { status: 204, headers: {}, body: {} },
    usageNotes:
      'Provide a token via `secretRefs.token` (an OpenBao path). The worker resolves and mounts it; the container reads /run/secrets/github_token.',
  },
  factory: (
    dag,
    context: CapabilityContext<GithubActionsDispatchConfig, GithubActionsDispatchSecrets>,
    input: GithubActionsDispatchInput
  ) => {
    type ContainerBuilder = {
      from(image: string): ContainerBuilder;
      withEnvVariable(key: string, value: string): ContainerBuilder;
      withMountedSecret?(path: string, secret: unknown): ContainerBuilder;
      withNewFile?(path: string, contents: string): ContainerBuilder;
      withExec(args: string[]): unknown;
    };
    type DaggerClient = { container(): ContainerBuilder };
    const d = dag as unknown as DaggerClient;

    const path = `/repos/${input.owner}/${input.repo}/actions/workflows/${input.workflow}/dispatches`;
    const payload = {
      mode: 'rest',
      baseUrl: context.config.baseUrl ?? 'https://api.github.com',
      allowOutbound: githubActionsDispatchCapability.security.networkAccess.allowOutbound,
      method: 'POST',
      path,
      query: {},
      body: { ref: input.ref, inputs: input.inputs ?? {} },
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

