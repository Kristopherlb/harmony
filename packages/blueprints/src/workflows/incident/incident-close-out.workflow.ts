/**
 * packages/blueprints/src/workflows/incident/incident-close-out.workflow.ts
 */
import { BaseBlueprint, ApprovalRejectedError, ApprovalTimeoutError } from '@golden/core/workflow';
import { z } from '@golden/schema-registry';
import { runIncidentCloseOut, type IncidentCloseOutOutput } from './incident-close-out.logic.js';

export interface IncidentCloseOutInput {
  incidentId: string;
  severity: 'P1' | 'P2' | 'P3' | 'P4';
  slackChannel: string;
  resolutionSummary: string;
  correlation: {
    pagerdutyIncidentId?: string;
    statuspageIncidentId?: string;
    statuspagePageId?: string;
  };
  approval?: {
    requiredRoles?: string[];
    timeout?: string;
  };
}

export class IncidentCloseOutWorkflow extends BaseBlueprint<IncidentCloseOutInput, IncidentCloseOutOutput, object> {
  readonly metadata = {
    id: 'blueprints.incident.close-out',
    version: '1.0.0',
    name: 'Incident Close-Out',
    description:
      'Closes out an incident by requesting approval, resolving PagerDuty/Statuspage incidents, and posting a close-out summary to Slack.',
    owner: 'platform',
    costCenter: 'CC-0',
    tags: ['incident', 'sre', 'operations'],
  };

  readonly security = {
    requiredRoles: ['incident-commander'],
    classification: 'CONFIDENTIAL' as const,
  };

  readonly operations = {
    sla: { targetDuration: '30m', maxDuration: '24h' },
  };

  readonly inputSchema = z
    .object({
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
    })
    .describe('Incident close-out input') as BaseBlueprint<
    IncidentCloseOutInput,
    IncidentCloseOutOutput,
    object
  >['inputSchema'];

  readonly configSchema = z.object({}).describe('No config') as BaseBlueprint<
    IncidentCloseOutInput,
    IncidentCloseOutOutput,
    object
  >['configSchema'];

  protected async logic(input: IncidentCloseOutInput, _config: object): Promise<IncidentCloseOutOutput> {
    void _config;
    return runIncidentCloseOut(
      {
        executeById: (capId, capInput) => this.executeById(capId, capInput),
        requestApproval: async (reason: string) => {
          try {
            await this.waitForApproval({
              reason,
              requiredRoles: input.approval?.requiredRoles ?? [],
              timeout: input.approval?.timeout,
              notifySlackChannel: input.slackChannel,
            });
            return { approved: true as const };
          } catch (err) {
            if (err instanceof ApprovalRejectedError) {
              return { approved: false as const, reason: err.decision.reason };
            }
            if (err instanceof ApprovalTimeoutError) {
              return { approved: false as const, reason: 'Approval timed out' };
            }
            return { approved: false as const, reason: err instanceof Error ? err.message : 'Approval failed' };
          }
        },
      },
      input
    );
  }
}

