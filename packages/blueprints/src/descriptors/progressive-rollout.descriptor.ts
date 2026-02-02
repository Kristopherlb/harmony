/**
 * packages/blueprints/src/descriptors/progressive-rollout.descriptor.ts
 * Blueprint descriptor for blueprints.traffic.progressive-rollout.
 */
import { z } from '@golden/schema-registry';
import type { BlueprintDescriptor } from './types.js';

export const progressiveRolloutBlueprintDescriptor: BlueprintDescriptor = {
  blueprintId: 'blueprints.traffic.progressive-rollout',
  workflowType: 'progressiveRolloutWorkflow',
  metadata: {
    id: 'blueprints.traffic.progressive-rollout',
    version: '1.0.0',
    description: 'Progressive rollout with staged canary analysis and automatic rollback.',
    domain: 'blueprints',
    subdomain: 'traffic.progressive-rollout',
    tags: ['blueprints'],
  },
  inputSchema: z.object({
    version: z.string().describe('New version being rolled out'),
    baselineVersion: z.string().describe('Baseline version to compare against'),
    prometheusUrl: z.string().describe('Prometheus URL for metrics'),
    service: z.string().describe('Service name for mesh routing'),
    stages: z.array(z.number().min(0).max(100)).optional().describe('Rollout stages'),
    analysisWindowSeconds: z.number().positive().optional().describe('Analysis window'),
    errorRateThreshold: z.number().min(0).max(1).optional().describe('Error rate threshold'),
    useMeshRouting: z.boolean().optional().describe('Use mesh routing'),
    namespace: z.string().optional().describe('Kubernetes namespace'),
    meshType: z.enum(['istio', 'linkerd']).optional().describe('Mesh type'),
  }),
  security: { classification: 'INTERNAL' },
};

