/**
 * packages/blueprints/src/descriptors/incident-close-out.descriptor.ts
 * Blueprint descriptor for blueprints.incident.close-out.
 */
import { z } from '@golden/schema-registry';
import type { BlueprintDescriptor } from './types.js';

export const incidentCloseOutBlueprintDescriptor: BlueprintDescriptor = {
  blueprintId: 'blueprints.incident.close-out',
  workflowType: 'incidentCloseOutWorkflow',
  metadata: {
    id: 'blueprints.incident.close-out',
    version: '1.0.0',
    description:
      'Closes out an incident by requesting approval, resolving PagerDuty/Statuspage incidents, and posting a close-out summary to Slack.',
    domain: 'blueprints',
    subdomain: 'incident.close-out',
    tags: ['blueprints', 'incident', 'operations'],
  },
  inputSchema: z.object({
    incidentId: z.string().min(1),
    severity: z.enum(['P1', 'P2', 'P3', 'P4']),
    slackChannel: z.string().min(1),
    resolutionSummary: z.string().min(1),
    correlation: z.object({
      pagerdutyIncidentId: z.string().optional(),
      statuspageIncidentId: z.string().optional(),
      statuspagePageId: z.string().optional(),
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

