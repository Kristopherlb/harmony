/**
 * packages/capabilities/src/connectors/jira-issue-search.capability.ts
 * Jira Connector: Search issues using JQL (preferred non-deprecated endpoint).
 *
 * Notes:
 * - Pure factory (OCS): returns a Dagger container definition only.
 * - Secrets are references/paths (ISS-001). Do not embed secret values in code/logs.
 */
import { z } from '@golden/schema-registry';
import type { Capability, CapabilityContext, ErrorCategory } from '@golden/core';
import { JIRA_HTTP_RUNTIME_CJS } from './jira-runtime';

const inputSchema = z
  .object({
    jql: z.string().min(1).describe('Bounded JQL query string.'),
    maxResults: z.number().int().min(1).max(5000).optional().describe('Max issues per page.'),
    fields: z.array(z.string()).optional().describe('Fields to include (default: id).'),
    nextPageToken: z.string().optional().describe('Paging token for subsequent pages.'),
    reconcileIssues: z.array(z.number().int()).max(50).optional().describe('Strong consistency issue ids to reconcile.'),
    failFast: z.boolean().optional().describe('Fail early if we cannot retrieve all field data.'),
    fieldsByKeys: z.boolean().optional().describe('Reference fields by key rather than id.'),
    expand: z.string().optional().describe('Comma-delimited expand values.'),
  })
  .describe('jiraIssueSearch input');

const outputSchema = z
  .record(z.unknown())
  .describe('jiraIssueSearch output (raw Jira response subset)');

const configSchema = z
  .object({
    host: z.string().min(1).describe('Jira base URL, e.g. https://your-domain.atlassian.net'),
    authMode: z.enum(['basic', 'oauth2']).describe('Auth mode for Jira requests.'),
    apiBasePath: z.string().optional().describe('Jira API base path (default: /rest/api/3).'),
  })
  .describe('jiraIssueSearch config');

const secretsSchema = z
  .object({
    // Secret *references* (paths) only.
    jiraEmail: z.string().optional().describe('Secret ref/path for Jira email (Basic Auth).'),
    jiraApiToken: z.string().optional().describe('Secret ref/path for Jira API token (Basic Auth).'),
    jiraAccessToken: z.string().optional().describe('Secret ref/path for Jira OAuth2 access token (Bearer).'),
  })
  .describe('jiraIssueSearch secrets (keys only)');

export type JiraIssueSearchInput = z.infer<typeof inputSchema>;
export type JiraIssueSearchOutput = z.infer<typeof outputSchema>;
export type JiraIssueSearchConfig = z.infer<typeof configSchema>;
export type JiraIssueSearchSecrets = z.infer<typeof secretsSchema>;

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

  // Fallback: some runtimes only surface status via exit code or message text.
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

export const jiraIssueSearchCapability: Capability<
  JiraIssueSearchInput,
  JiraIssueSearchOutput,
  JiraIssueSearchConfig,
  JiraIssueSearchSecrets
> = {
  metadata: {
    id: 'golden.jira.issue.search',
    version: '1.0.0',
    name: 'jiraIssueSearch',
    description: 'Search Jira issues using JQL via /rest/api/3/search/jql.',
    tags: ['jira', 'connector', 'issue-search'],
    maintainer: 'platform',
  },
  schemas: {
    input: inputSchema,
    output: outputSchema,
    config: configSchema,
    secrets: secretsSchema,
  },
  security: {
    requiredScopes: ['read:jira-work'],
    dataClassification: 'CONFIDENTIAL',
    networkAccess: {
      allowOutbound: [],
    },
  },
  operations: {
    isIdempotent: true,
    retryPolicy: { maxAttempts: 3, initialIntervalSeconds: 1, backoffCoefficient: 2 },
    errorMap: (err) => mapHttpStatusToErrorCategory(extractStatus(err)),
    costFactor: 'LOW',
  },
  aiHints: {
    exampleInput: {
      jql: 'project = HSP order by updated desc',
      maxResults: 50,
      fields: ['id', 'key'],
    },
    exampleOutput: {},
    usageNotes:
      'Prefer bounded JQL. Use nextPageToken for pagination. Provide reconcileIssues if you need stronger consistency.',
  },
  factory: (
    dag,
    context: CapabilityContext<JiraIssueSearchConfig, JiraIssueSearchSecrets>,
    input: JiraIssueSearchInput
  ) => {
    const host = context.config.host;
    const apiBasePath = context.config.apiBasePath ?? '/rest/api/3';
    const authMode = context.config.authMode;
    const path = `${apiBasePath}/search/jql`;

    // Pure factory: package all runtime parameters into INPUT_JSON.
    const payload = {
      method: 'GET',
      host,
      path,
      authMode,
      query: {
        jql: input.jql,
        maxResults: input.maxResults,
        fields: input.fields,
        nextPageToken: input.nextPageToken,
        reconcileIssues: input.reconcileIssues,
        failFast: input.failFast,
        fieldsByKeys: input.fieldsByKeys,
        expand: input.expand,
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

    // Mount secrets (platform resolves refs to Dagger Secrets when available).
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

