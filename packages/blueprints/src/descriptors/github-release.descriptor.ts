/**
 * packages/blueprints/src/descriptors/github-release.descriptor.ts
 * Blueprint descriptor for blueprints.ci.github-release.
 */
import { z } from '@golden/schema-registry';
import type { BlueprintDescriptor } from './types.js';

export const githubReleaseBlueprintDescriptor: BlueprintDescriptor = {
  blueprintId: 'blueprints.ci.github-release',
  workflowType: 'githubReleaseWorkflow',
  metadata: {
    id: 'blueprints.ci.github-release',
    version: '1.0.0',
    description: 'GitHub webhook-triggered release workflow composed from GitHub REST + GraphQL capabilities.',
    domain: 'blueprints',
    subdomain: 'ci.github-release',
    tags: ['blueprints'],
  },
  inputSchema: z.object({
    deliveryId: z.string().min(1).describe('GitHub delivery id (X-GitHub-Delivery)'),
    eventType: z.string().min(1).describe('GitHub event type (X-GitHub-Event)'),
    action: z.string().optional().describe('GitHub payload action field (if present)'),
    repoFullName: z.string().min(1).describe('Repo full name (owner/repo)'),
    ref: z.string().optional().describe('Git ref (if present)'),
    sha: z.string().optional().describe('Commit SHA (if present)'),
    actor: z.string().optional().describe('Actor login (if present)'),
    receivedAt: z.string().min(1).describe('Ingress timestamp generated outside workflow'),
    githubTokenSecretRef: z.string().min(1).describe('OpenBao secretRef for GitHub token'),
  }),
  security: { classification: 'INTERNAL' },
};

