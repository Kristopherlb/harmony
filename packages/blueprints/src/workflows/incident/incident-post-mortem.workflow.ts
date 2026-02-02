/**
 * packages/blueprints/src/workflows/incident/incident-post-mortem.workflow.ts
 */
import { BaseBlueprint, ApprovalRejectedError, ApprovalTimeoutError } from '@golden/core/workflow';
import { z } from '@golden/schema-registry';
import { runIncidentPostMortem, type IncidentPostMortemOutput } from './incident-post-mortem.logic.js';

export interface IncidentPostMortemInput {
  incidentId: string;
  severity: 'P1' | 'P2' | 'P3' | 'P4';
  slackChannel: string;
  title: string;
  confluence: {
    spaceKey: string;
    parentId?: string;
    labels?: string[];
  };
  approval?: {
    requiredRoles?: string[];
    timeout?: string;
  };
}

export class IncidentPostMortemWorkflow extends BaseBlueprint<
  IncidentPostMortemInput,
  IncidentPostMortemOutput,
  object
> {
  readonly metadata = {
    id: 'blueprints.incident.post-mortem',
    version: '1.0.0',
    name: 'Incident Post-Mortem',
    description: 'Creates a post-mortem Confluence page from a template and posts the link to Slack.',
    owner: 'platform',
    costCenter: 'CC-0',
    tags: ['incident', 'sre', 'operations'],
  };

  readonly security = {
    requiredRoles: ['incident-commander', 'platform-ops'],
    classification: 'CONFIDENTIAL' as const,
  };

  readonly operations = {
    sla: { targetDuration: '1h', maxDuration: '24h' },
  };

  readonly inputSchema = z
    .object({
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
    })
    .describe('Incident post-mortem input') as BaseBlueprint<
    IncidentPostMortemInput,
    IncidentPostMortemOutput,
    object
  >['inputSchema'];

  readonly configSchema = z.object({}).describe('No config') as BaseBlueprint<
    IncidentPostMortemInput,
    IncidentPostMortemOutput,
    object
  >['configSchema'];

  protected async logic(input: IncidentPostMortemInput, _config: object): Promise<IncidentPostMortemOutput> {
    void _config;
    return runIncidentPostMortem(
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

