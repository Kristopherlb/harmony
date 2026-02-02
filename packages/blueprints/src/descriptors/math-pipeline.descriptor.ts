/**
 * packages/blueprints/src/descriptors/math-pipeline.descriptor.ts
 * Blueprint descriptor for workflows.math_pipeline.
 */
import { z } from '@golden/schema-registry';
import type { BlueprintDescriptor } from './types.js';

export const mathPipelineBlueprintDescriptor: BlueprintDescriptor = {
  blueprintId: 'workflows.math_pipeline',
  workflowType: 'mathPipelineWorkflow',
  metadata: {
    id: 'workflows.math_pipeline',
    version: '1.0.0',
    description: 'Composes demo capabilities (math_add + echo).',
    domain: 'workflows',
    subdomain: 'math_pipeline',
    tags: ['workflows'],
  },
  inputSchema: z.object({ a: z.number(), b: z.number(), c: z.number() }),
  security: { classification: 'INTERNAL' },
};

