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
    /**
     * Discovery taxonomy (CDM-001).
     *
     * NOTE: This is optional for backwards compatibility, but CI/generators
     * should enforce/populate it for all new/updated descriptors.
     */
    domain?: string;
    /**
     * Optional finer-grained discovery taxonomy (CDM-001).
     */
    subdomain?: string;
    /**
     * Discovery tags used by the Console palette/catalog (CDM-001).
     *
     * NOTE: Optional for backwards compatibility; enforced by CI/generators.
     */
    tags?: string[];
  };
  inputSchema: z.ZodSchema<unknown>;
  security?: {
    classification?: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
  };
}

