/**
 * packages/blueprints/src/descriptors/release-pipeline.descriptor.ts
 * Blueprint descriptor for blueprints.ci.release-pipeline.
 */
import { z } from '@golden/schema-registry';
import type { BlueprintDescriptor } from './types.js';

export const releasePipelineBlueprintDescriptor: BlueprintDescriptor = {
  blueprintId: 'blueprints.ci.release-pipeline',
  workflowType: 'releasePipelineWorkflow',
  metadata: {
    id: 'blueprints.ci.release-pipeline',
    version: '1.0.0',
    description: 'Release pipeline: certification, security scans, OSCAL generation, and release manifest bundling.',
    domain: 'blueprints',
    subdomain: 'ci.release-pipeline',
    tags: ['blueprints'],
  },
  inputSchema: z.object({
    version: z.string().describe('Release version'),
    gitSha: z.string().describe('Git commit SHA'),
    contextPath: z.string().describe('Path to context for scanning'),
    artifactPaths: z.array(z.string()).optional().describe('Paths to audit'),
    skipChecks: z.array(z.string()).optional().describe('Checks to skip'),
    continueOnWarning: z.boolean().optional().describe('Continue on warnings'),
  }),
  security: { classification: 'INTERNAL' },
};

