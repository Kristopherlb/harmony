/**
 * packages/blueprints/src/descriptors/incident-initiate.descriptor.ts
 * Blueprint descriptor for blueprints.incident.initiate.
 */
import { z } from '@golden/schema-registry';
import type { BlueprintDescriptor } from './types.js';

export const incidentInitiateBlueprintDescriptor: BlueprintDescriptor = {
  blueprintId: 'blueprints.incident.initiate',
  workflowType: 'incidentInitiateWorkflow',
  metadata: {
    id: 'blueprints.incident.initiate',
    version: '1.0.0',
    description: 'Initiates an incident: announces in Slack and optionally creates PagerDuty/Statuspage incidents.',
    domain: 'blueprints',
    subdomain: 'incident.initiate',
    tags: ['blueprints', 'incident', 'operations'],
  },
  inputSchema: z.object({
    title: z.string().min(1),
    severity: z.enum(['P1', 'P2', 'P3', 'P4']),
    slackChannel: z.string().min(1),
    summary: z.string().optional(),
    incidentId: z.string().optional(),
    sequence: z.number().int().positive().optional(),
    notifyPagerDuty: z.boolean().optional(),
    createStatuspageIncident: z.boolean().optional(),
    pagerduty: z.object({ serviceId: z.string().optional() }).optional(),
    statuspage: z.object({ pageId: z.string().optional() }).optional(),
    slack: z.object({ blocks: z.array(z.unknown()).optional() }).optional(),
  }),
  security: { classification: 'CONFIDENTIAL' },
};

