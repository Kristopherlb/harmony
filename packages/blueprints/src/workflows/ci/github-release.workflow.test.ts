/**
 * packages/blueprints/src/workflows/ci/github-release.workflow.test.ts
 */
import { describe, it, expect, vi } from 'vitest';
import { GitHubReleaseWorkflow } from './github-release.workflow.js';

describe('GitHubReleaseWorkflow', () => {
  const workflow = new GitHubReleaseWorkflow();

  it('declares required WCS metadata fields', () => {
    expect(workflow.metadata.id).toBe('blueprints.ci.github-release');
    expect(workflow.metadata.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(workflow.metadata.owner).toBe('platform');
    expect(Array.isArray(workflow.metadata.tags)).toBe(true);
  });

  it('validates minimal input', () => {
    expect(() =>
      workflow.inputSchema.parse({
        deliveryId: 'd1',
        eventType: 'push',
        repoFullName: 'octocat/hello-world',
        receivedAt: '2026-02-09T00:00:00.000Z',
        githubTokenSecretRef: '/artifacts/console/public/secrets/github.token',
      })
    ).not.toThrow();
  });

  it('composes GitHub REST + GraphQL capabilities with token secretRef', async () => {
    const calls: Array<{ capId: string; input: unknown; options: unknown }> = [];
    (workflow as any).executeById = vi.fn(async (capId: string, input: unknown, options: unknown) => {
      calls.push({ capId, input, options });
      return { status: 200, headers: {}, body: {} };
    });

    const out = await workflow.main(
      {
        deliveryId: 'd1',
        eventType: 'push',
        repoFullName: 'octocat/hello-world',
        sha: 'abc123',
        receivedAt: '2026-02-09T00:00:00.000Z',
        githubTokenSecretRef: '/artifacts/console/public/secrets/github.token',
      },
      {}
    );

    expect(out.ok).toBe(true);
    expect(calls.map((c) => c.capId)).toEqual([
      'golden.github.rest.request',
      'golden.github.graphql.query',
    ]);
    expect(calls[0]!.options).toMatchObject({
      secretRefs: { token: '/artifacts/console/public/secrets/github.token' },
    });
    expect(calls[1]!.options).toMatchObject({
      secretRefs: { token: '/artifacts/console/public/secrets/github.token' },
    });
  });

  it('optionally dispatches a GitHub Actions workflow when configured', async () => {
    const calls: Array<{ capId: string; input: unknown; options: unknown }> = [];
    (workflow as any).executeById = vi.fn(async (capId: string, input: unknown, options: unknown) => {
      calls.push({ capId, input, options });
      return { status: 204, headers: {}, body: {} };
    });

    const out = await workflow.main(
      {
        deliveryId: 'd1',
        eventType: 'push',
        repoFullName: 'octocat/hello-world',
        receivedAt: '2026-02-09T00:00:00.000Z',
        githubTokenSecretRef: '/artifacts/console/public/secrets/github.token',
      },
      {
        actionsDispatch: {
          workflow: 'release.yml',
          ref: 'main',
          inputs: { version: 'v1.2.3' },
        },
      } as any
    );

    expect(out.ok).toBe(true);
    expect(calls.map((c) => c.capId)).toEqual([
      'golden.github.rest.request',
      'golden.github.graphql.query',
      'golden.github.actions.dispatch',
    ]);
    expect(calls[2]!.options).toMatchObject({
      secretRefs: { token: '/artifacts/console/public/secrets/github.token' },
    });
    expect(calls[2]!.input).toMatchObject({
      owner: 'octocat',
      repo: 'hello-world',
      workflow: 'release.yml',
      ref: 'main',
      inputs: { version: 'v1.2.3' },
    });
  });
});

