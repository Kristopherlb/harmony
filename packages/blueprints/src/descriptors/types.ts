/**
 * packages/blueprints/src/descriptors/types.ts
 * Blueprint descriptor types (safe to import from Node-land).
 */
import type { z } from '@golden/schema-registry';

export interface BlueprintDescriptor {
  blueprintId: string;
  workflowType: string;
  metadata: {
    id: string;
    version: string;
    description: string;
  };
  inputSchema: z.ZodSchema<unknown>;
  security?: {
    classification?: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
  };
}

