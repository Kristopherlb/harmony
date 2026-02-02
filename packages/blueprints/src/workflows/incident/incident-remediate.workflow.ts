/**
 * packages/blueprints/src/workflows/incident/incident-remediate.workflow.ts
 */
import { BaseBlueprint, ApprovalRejectedError, ApprovalTimeoutError } from '@golden/core/workflow';
import { z } from '@golden/schema-registry';
import { runIncidentRemediate, type IncidentRemediateOutput } from './incident-remediate.logic.js';

export interface IncidentRemediateInput {
  incidentId: string;
  severity: 'P1' | 'P2' | 'P3' | 'P4';
  slackChannel: string;
  remediation: {
    kind: 'runbook';
    path: string;
    cells?: string[];
    env?: Record<string, string>;
    timeout?: string;
    workdir?: string;
  };
  approval?: {
    /**
     * NOTE: Slack interactive approvals currently do not populate roles (approverRoles: []).
     * If you set requiredRoles here, Slack-driven approvals may be ignored until role mapping is implemented.
     */
    requiredRoles?: string[];
    timeout?: string;
  };
  kubectl?: {
    enabled?: boolean;
    operation?: 'apply' | 'get' | 'delete' | 'logs' | 'exec';
    manifest?: string;
    resourceName?: string;
    namespace?: string;
    context?: string;
    command?: string[];
    container?: string;
    flags?: string[];
  };
}

export class IncidentRemediateWorkflow extends BaseBlueprint<IncidentRemediateInput, IncidentRemediateOutput, object> {
  readonly metadata = {
    id: 'blueprints.incident.remediate',
    version: '1.0.0',
    name: 'Incident Remediate',
    description:
      'Remediates an incident by requesting approval and executing a runbook (Runme), with optional kubectl actions and Slack updates.',
    owner: 'platform',
    costCenter: 'CC-0',
    tags: ['incident', 'sre', 'operations'],
  };

  readonly security = {
    requiredRoles: ['incident-commander', 'sre-oncall'],
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
    })
    .describe('Incident remediate input') as BaseBlueprint<
    IncidentRemediateInput,
    IncidentRemediateOutput,
    object
  >['inputSchema'];

  readonly configSchema = z.object({}).describe('No config') as BaseBlueprint<
    IncidentRemediateInput,
    IncidentRemediateOutput,
    object
  >['configSchema'];

  protected async logic(input: IncidentRemediateInput, _config: object): Promise<IncidentRemediateOutput> {
    void _config;
    return runIncidentRemediate(
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
        nowMs: this.now,
      },
      input
    );
  }
}

