/**
 * packages/blueprints/src/descriptors/echo.descriptor.ts
 * Blueprint descriptor for workflows.echo.
 */
import { z } from '@golden/schema-registry';
import type { BlueprintDescriptor } from './types.js';

export const echoBlueprintDescriptor: BlueprintDescriptor = {
  blueprintId: 'workflows.echo',
  workflowType: 'echoWorkflow',
  metadata: {
    id: 'workflows.echo',
    version: '1.0.0',
    description: 'E2e workflow',
    domain: 'workflows',
    subdomain: 'echo',
    tags: ['workflows'],
  },
  inputSchema: z.object({ x: z.number() }),
  security: { classification: 'INTERNAL' },
};

