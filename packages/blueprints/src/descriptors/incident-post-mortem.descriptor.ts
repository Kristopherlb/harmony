/**
 * packages/blueprints/src/descriptors/incident-post-mortem.descriptor.ts
 * Blueprint descriptor for blueprints.incident.post-mortem.
 */
import { z } from '@golden/schema-registry';
import type { BlueprintDescriptor } from './types.js';

export const incidentPostMortemBlueprintDescriptor: BlueprintDescriptor = {
  blueprintId: 'blueprints.incident.post-mortem',
  workflowType: 'incidentPostMortemWorkflow',
  metadata: {
    id: 'blueprints.incident.post-mortem',
    version: '1.0.0',
    description: 'Creates a post-mortem Confluence page from a template and posts the link to Slack.',
    domain: 'blueprints',
    subdomain: 'incident.post-mortem',
    tags: ['blueprints', 'incident', 'operations'],
  },
  inputSchema: z.object({
    incidentId: z.string().min(1),
    severity: z.enum(['P1', 'P2', 'P3', 'P4']),
    slackChannel: z.string().min(1),
    title: z.string().min(1),
    confluence: z.object({
      spaceKey: z.string().min(1),
      parentId: z.string().optional(),
      labels: z.array(z.string()).optional(),
    }),
    approval: z
      .object({
        requiredRoles: z.array(z.string()).optional(),
        timeout: z.string().optional(),
      })
      .optional(),
  }),
  security: { classification: 'CONFIDENTIAL' },
};

