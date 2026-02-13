/**
 * packages/capabilities/src/connectors/jira-issue-create.capability.ts
 * Jira Connector: Create an issue (write).
 *
 * Purpose: Provide an intent-shaped capability for creating Jira issues without using generic HTTP tooling.
 */
import { z } from '@golden/schema-registry';
import type { Capability, CapabilityContext, ErrorCategory } from '@golden/core';
import { JIRA_HTTP_RUNTIME_CJS } from './jira-runtime';

const inputSchema = z
  .object({
    projectKey: z.string().min(1).describe('Jira project key (e.g. HSP).'),
    issueType: z.string().min(1).default('Task').describe('Issue type name (e.g. Task, Bug, Incident).'),
    summary: z.string().min(1).describe('Issue summary/title.'),
    description: z.string().optional().describe('Issue description (plain text).'),
    labels: z.array(z.string()).optional().describe('Optional labels/tags.'),
  })
  .describe('jiraIssueCreate input');

const outputSchema = z
  .object({
    id: z.string().optional(),
    key: z.string().optional(),
    self: z.string().optional(),
  })
  .passthrough()
  .describe('jiraIssueCreate output (raw Jira create response)');

const configSchema = z
  .object({
    host: z.string().min(1).describe('Jira base URL, e.g. https://your-domain.atlassian.net'),
    authMode: z.enum(['basic', 'oauth2']).describe('Auth mode for Jira requests.'),
    apiBasePath: z.string().optional().describe('Jira API base path (default: /rest/api/3).'),
  })
  .describe('jiraIssueCreate config');

const secretsSchema = z
  .object({
    jiraEmail: z.string().optional().describe('Secret ref/path for Jira email (Basic Auth).'),
    jiraApiToken: z.string().optional().describe('Secret ref/path for Jira API token (Basic Auth).'),
    jiraAccessToken: z.string().optional().describe('Secret ref/path for Jira OAuth2 access token (Bearer).'),
  })
  .describe('jiraIssueCreate secrets (keys only)');

export type JiraIssueCreateInput = z.infer<typeof inputSchema>;
export type JiraIssueCreateOutput = z.infer<typeof outputSchema>;
export type JiraIssueCreateConfig = z.infer<typeof configSchema>;
export type JiraIssueCreateSecrets = z.infer<typeof secretsSchema>;

function mapHttpStatusToErrorCategory(status: number | undefined): ErrorCategory {
  if (status === 401 || status === 403) return 'AUTH_FAILURE';
  if (status === 429) return 'RATE_LIMIT';
  if (typeof status === 'number' && status >= 500) return 'RETRYABLE';
  if (typeof status === 'number' && status >= 400) return 'FATAL';
  return 'FATAL';
}

function extractStatus(error: unknown): number | undefined {
  const anyErr =
    error && typeof error === 'object'
      ? (error as {
          status?: unknown;
          message?: unknown;
          exitCode?: unknown;
          code?: unknown;
          response?: { status?: unknown };
          cause?: { status?: unknown; message?: unknown };
        })
      : undefined;
  const s1 = anyErr?.status;
  if (typeof s1 === 'number') return s1;
  const s2 = anyErr?.response?.status;
  if (typeof s2 === 'number') return s2;
  const s3 = anyErr?.cause?.status;
  if (typeof s3 === 'number') return s3;

  const exitCode = anyErr?.exitCode ?? anyErr?.code;
  if (typeof exitCode === 'number' && exitCode >= 100 && exitCode <= 599) return exitCode;

  const msg =
    (typeof anyErr?.message === 'string' ? anyErr.message : undefined) ??
    (typeof anyErr?.cause?.message === 'string' ? anyErr.cause.message : undefined);
  if (msg) {
    const m = msg.match(/\bHTTP\s+(\d{3})\b/i) ?? msg.match(/\b(\d{3})\b/);
    if (m?.[1]) {
      const n = Number(m[1]);
      if (Number.isFinite(n)) return n;
    }
  }
  return undefined;
}

export const jiraIssueCreateCapability: Capability<
  JiraIssueCreateInput,
  JiraIssueCreateOutput,
  JiraIssueCreateConfig,
  JiraIssueCreateSecrets
> = {
  metadata: {
    id: 'golden.jira.issue.create',
    domain: 'jira',
    version: '1.0.0',
    name: 'jiraIssueCreate',
    description: 'Create a Jira issue in a specific project with a simple, typed input schema.',
    tags: ['jira', 'connector', 'write', 'issue-create'],
    maintainer: 'platform',
  },
  schemas: {
    input: inputSchema,
    output: outputSchema,
    config: configSchema,
    secrets: secretsSchema,
  },
  security: {
    requiredScopes: ['write:jira-work'],
    dataClassification: 'RESTRICTED',
    networkAccess: { allowOutbound: [] },
  },
  operations: {
    isIdempotent: false,
    retryPolicy: { maxAttempts: 1, initialIntervalSeconds: 1, backoffCoefficient: 1 },
    errorMap: (err) => mapHttpStatusToErrorCategory(extractStatus(err)),
    costFactor: 'LOW',
  },
  aiHints: {
    exampleInput: {
      projectKey: 'HSP',
      issueType: 'Task',
      summary: 'Investigate elevated 500s',
      description: 'Triage: correlate error spike with deploy 2026-02-11.',
      labels: ['incident', 'triage'],
    },
    exampleOutput: { id: '10001', key: 'HSP-123', self: 'https://example.atlassian.net/rest/api/3/issue/10001' },
    usageNotes:
      'Use for deterministic issue creation. Provide auth via secretRefs (basic or oauth2). For rich Jira descriptions, prefer ADF support in a future enhancement.',
  },
  factory: (
    dag,
    context: CapabilityContext<JiraIssueCreateConfig, JiraIssueCreateSecrets>,
    input: JiraIssueCreateInput
  ) => {
    const host = context.config.host;
    const apiBasePath = context.config.apiBasePath ?? '/rest/api/3';
    const authMode = context.config.authMode;
    const path = `${apiBasePath}/issue`;

    const payload = {
      method: 'POST',
      host,
      path,
      authMode,
      body: {
        fields: {
          project: { key: input.projectKey },
          summary: input.summary,
          issuetype: { name: input.issueType },
          ...(input.description ? { description: input.description } : {}),
          ...(input.labels ? { labels: input.labels } : {}),
        },
      },
      secretRefs: context.secretRefs,
    };

    type ContainerBuilder = {
      from(image: string): ContainerBuilder;
      withEnvVariable(key: string, value: string): ContainerBuilder;
      withNewFile?(path: string, contents: string): ContainerBuilder;
      withMountedSecret?(path: string, secret: unknown): ContainerBuilder;
      withExec(args: string[]): unknown;
    };
    type DaggerClient = { container(): ContainerBuilder };
    const d = dag as unknown as DaggerClient;

    let container = d.container().from('node:20-alpine').withEnvVariable('INPUT_JSON', JSON.stringify(payload));

    if (typeof (container as Record<string, unknown>).withMountedSecret === 'function') {
      if (context.secretRefs.jiraEmail) {
        container = container.withMountedSecret!('/run/secrets/jira_email', context.secretRefs.jiraEmail);
      }
      if (context.secretRefs.jiraApiToken) {
        container = container.withMountedSecret!('/run/secrets/jira_api_token', context.secretRefs.jiraApiToken);
      }
      if (context.secretRefs.jiraAccessToken) {
        container = container.withMountedSecret!('/run/secrets/jira_access_token', context.secretRefs.jiraAccessToken);
      }
    }

    if (typeof (container as Record<string, unknown>).withNewFile === 'function') {
      container = container.withNewFile!('/opt/jira-runtime.cjs', JIRA_HTTP_RUNTIME_CJS);
    }

    return container.withExec(['node', '/opt/jira-runtime.cjs']);
  },
};

