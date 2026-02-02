/**
 * packages/blueprints/src/descriptors/blue-green-deploy.descriptor.ts
 * Blueprint descriptor for blueprints.deploy.blue-green.
 */
import { z } from '@golden/schema-registry';
import type { BlueprintDescriptor } from './types.js';

export const blueGreenDeployBlueprintDescriptor: BlueprintDescriptor = {
  blueprintId: 'blueprints.deploy.blue-green',
  workflowType: 'blueGreenDeployWorkflow',
  metadata: {
    id: 'blueprints.deploy.blue-green',
    version: '1.0.0',
    description:
      'Blue/green deployment with container build + K8s apply + Temporal build-id versioning, with optional drain and flag sync.',
    domain: 'blueprints',
    subdomain: 'deploy.blue-green',
    tags: ['blueprints'],
  },
  inputSchema: z.object({
    version: z.string().describe('Release version / Build ID'),
    registry: z.string().describe('Container registry address'),
    contextPath: z.string().describe('Build context path'),
    taskQueue: z.string().optional().default('golden-tools').describe('Temporal task queue'),
    previousBuildId: z.string().optional().describe('Previous Build ID to drain'),
    namespace: z.string().optional().describe('Kubernetes namespace'),
    manifestPath: z.string().optional().describe('Path to K8s manifests'),
    dockerfile: z.string().optional().describe('Dockerfile path'),
    buildArgs: z.record(z.string()).optional().describe('Additional build args'),
    skipFlags: z.boolean().optional().describe('Skip flag generation'),
    waitForDrain: z.boolean().optional().default(true).describe('Wait for old version drain'),
    drainTimeoutSeconds: z.number().optional().describe('Drain timeout'),
  }),
  security: { classification: 'INTERNAL' },
};

