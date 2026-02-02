import { describe, it, expect } from 'vitest';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import webhookHandlerGenerator from './generator';

describe('@golden/path:webhook-handler', () => {
  it('generates handler + test files for console server', async () => {
    const tree = createTreeWithEmptyWorkspace();

    await expect(
      webhookHandlerGenerator(tree, {
        name: 'github-webhook',
        source: 'github',
        signatureHeader: 'x-hub-signature-256',
        signatureAlgorithm: 'sha256',
      })
    ).resolves.toBeDefined();

    expect(tree.exists('packages/apps/console/server/integrations/http/github-webhook-handler.ts')).toBe(true);
    expect(tree.exists('packages/apps/console/server/integrations/http/github-webhook-handler.test.ts')).toBe(true);

    const handler = tree.read(
      'packages/apps/console/server/integrations/http/github-webhook-handler.ts',
      'utf-8'
    )!;
    expect(handler).toContain('export function createGithubWebhookHandler');
    expect(handler).toContain('export function createWebhookVerificationMiddleware');
    expect(handler).toContain('x-hub-signature-256');
  });

  it('is idempotent', async () => {
    const tree = createTreeWithEmptyWorkspace();

    await webhookHandlerGenerator(tree, {
      name: 'github-webhook',
      source: 'github',
      signatureHeader: 'x-hub-signature-256',
      signatureAlgorithm: 'sha256',
    });
    const once = tree.read(
      'packages/apps/console/server/integrations/http/github-webhook-handler.ts',
      'utf-8'
    )!;

    await webhookHandlerGenerator(tree, {
      name: 'github-webhook',
      source: 'github',
      signatureHeader: 'x-hub-signature-256',
      signatureAlgorithm: 'sha256',
    });
    const twice = tree.read(
      'packages/apps/console/server/integrations/http/github-webhook-handler.ts',
      'utf-8'
    )!;

    expect(twice).toBe(once);
  });
});

