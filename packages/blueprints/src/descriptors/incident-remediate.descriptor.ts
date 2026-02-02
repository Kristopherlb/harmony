/**
 * packages/blueprints/src/descriptors/incident-remediate.descriptor.ts
 * Blueprint descriptor for blueprints.incident.remediate.
 */
import { z } from '@golden/schema-registry';
import type { BlueprintDescriptor } from './types.js';

export const incidentRemediateBlueprintDescriptor: BlueprintDescriptor = {
  blueprintId: 'blueprints.incident.remediate',
  workflowType: 'incidentRemediateWorkflow',
  metadata: {
    id: 'blueprints.incident.remediate',
    version: '1.0.0',
    description:
      'Remediates an incident by requesting approval and executing a runbook (Runme), with optional kubectl actions and Slack updates.',
    domain: 'blueprints',
    subdomain: 'incident.remediate',
    tags: ['blueprints', 'incident', 'operations'],
  },
  inputSchema: z.object({
    incidentId: z.string().min(1),
    severity: z.enum(['P1', 'P2', 'P3', 'P4']),
    slackChannel: z.string().min(1),
    remediation: z.object({
      kind: z.literal('runbook'),
      path: z.string().min(1),
      cells: z.array(z.string()).optional(),
      env: z.record(z.string()).optional(),
      timeout: z.string().optional(),
      workdir: z.string().optional(),
    }),
    approval: z
      .object({
        requiredRoles: z.array(z.string()).optional(),
        timeout: z.string().optional(),
      })
      .optional(),
    kubectl: z
      .object({
        enabled: z.boolean().optional(),
        operation: z.enum(['apply', 'get', 'delete', 'logs', 'exec']).optional(),
        manifest: z.string().optional(),
        resourceName: z.string().optional(),
        namespace: z.string().optional(),
        context: z.string().optional(),
        command: z.array(z.string()).optional(),
        container: z.string().optional(),
        flags: z.array(z.string()).optional(),
      })
      .optional(),
  }),
  security: { classification: 'CONFIDENTIAL' },
};

