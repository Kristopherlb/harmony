/**
 * packages/blueprints/src/workflows/ci/github-release.workflow.ts
 * GitHub-triggered release blueprint (WCS-001).
 *
 * Purpose: Normalize a GitHub webhook envelope into a deterministic workflow input,
 * then compose core GitHub capabilities to validate repo context and perform
 * optional release-side effects (kept minimal for MVP).
 */
import { BaseBlueprint } from '@golden/core/workflow';
import { z } from '@golden/schema-registry';

export interface GitHubReleaseInput {
  deliveryId: string;
  eventType: string;
  action?: string;
  repoFullName: string;
  ref?: string;
  sha?: string;
  actor?: string;
  receivedAt: string;
  githubTokenSecretRef: string;
}

export interface GitHubReleaseOutput {
  ok: true;
  deliveryId: string;
  repoFullName: string;
  receivedAt: string;
}

export interface GitHubReleaseConfig {
  /**
   * Optional side-effect: dispatch a GitHub Actions workflow via workflow_dispatch.
   * Use only when you intentionally want release webhook ingestion to trigger CI/CD.
   */
  actionsDispatch?: {
    workflow: string;
    ref: string;
    inputs?: Record<string, string>;
  };
}

function parseRepoFullName(fullName: string): { owner: string; repo: string } {
  const parts = String(fullName).split('/').filter(Boolean);
  if (parts.length !== 2) throw new Error('Invalid repoFullName (expected owner/repo)');
  return { owner: parts[0]!, repo: parts[1]! };
}

export class GitHubReleaseWorkflow extends BaseBlueprint<
  GitHubReleaseInput,
  GitHubReleaseOutput,
  GitHubReleaseConfig
> {
  readonly metadata = {
    id: 'blueprints.ci.github-release',
    version: '1.0.0',
    name: 'GitHub Release (Webhook Triggered)',
    description:
      'GitHub webhook-triggered release workflow. Validates repo context via GitHub REST + GraphQL capabilities and produces a deterministic release envelope output.',
    owner: 'platform',
    costCenter: 'CC-0',
    tags: ['ci', 'release', 'github'],
  };

  readonly security = {
    requiredRoles: ['ci:release'],
    classification: 'INTERNAL' as const,
    oscalControlIds: ['CM-3', 'AU-2'],
  };

  readonly operations = {
    sla: { targetDuration: '2m', maxDuration: '10m' },
    alerting: { errorRateThreshold: 0.1 },
  };

  readonly inputSchema = z.object({
    deliveryId: z.string().min(1).describe('GitHub delivery id (X-GitHub-Delivery)'),
    eventType: z.string().min(1).describe('GitHub event type (X-GitHub-Event)'),
    action: z.string().optional().describe('GitHub payload action field (if present)'),
    repoFullName: z.string().min(1).describe('Repo full name (owner/repo)'),
    ref: z.string().optional().describe('Git ref (if present)'),
    sha: z.string().optional().describe('Commit SHA (if present)'),
    actor: z.string().optional().describe('Actor login (if present)'),
    receivedAt: z.string().min(1).describe('Ingress timestamp generated outside workflow'),
    githubTokenSecretRef: z.string().min(1).describe('OpenBao secretRef for GitHub token'),
  }) as BaseBlueprint<GitHubReleaseInput, GitHubReleaseOutput, GitHubReleaseConfig>['inputSchema'];

  readonly configSchema = z.object({
    actionsDispatch: z
      .object({
        workflow: z.string().min(1).describe('Workflow filename (e.g. release.yml) or numeric workflow ID as string.'),
        ref: z.string().min(1).describe('Git ref to dispatch (e.g. main).'),
        inputs: z.record(z.string()).optional().describe('workflow_dispatch inputs (string values).'),
      })
      .optional()
      .describe('Optional GitHub Actions dispatch'),
  }) as BaseBlueprint<
    GitHubReleaseInput,
    GitHubReleaseOutput,
    GitHubReleaseConfig
  >['configSchema'];

  protected async logic(input: GitHubReleaseInput, config: GitHubReleaseConfig): Promise<GitHubReleaseOutput> {

    const { owner, repo } = parseRepoFullName(input.repoFullName);
    const tokenRef = input.githubTokenSecretRef;

    // Step 1: REST sanity check (idempotent GET)
    await this.executeById(
      'golden.github.rest.request',
      { method: 'GET', path: `/repos/${owner}/${repo}` },
      { secretRefs: { token: tokenRef } }
    );

    // Step 2: GraphQL sanity check
    await this.executeById(
      'golden.github.graphql.query',
      { query: 'query { viewer { login } }', variables: {} },
      { secretRefs: { token: tokenRef } }
    );

    // Step 3 (optional): Dispatch a GitHub Actions workflow.
    if (config.actionsDispatch) {
      await this.executeById(
        'golden.github.actions.dispatch',
        {
          owner,
          repo,
          workflow: config.actionsDispatch.workflow,
          ref: config.actionsDispatch.ref,
          inputs: config.actionsDispatch.inputs ?? {},
        },
        { secretRefs: { token: tokenRef } }
      );
    }

    return {
      ok: true,
      deliveryId: input.deliveryId,
      repoFullName: input.repoFullName,
      receivedAt: input.receivedAt,
    };
  }
}

