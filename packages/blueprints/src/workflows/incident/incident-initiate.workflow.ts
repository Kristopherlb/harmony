/**
 * packages/blueprints/src/workflows/incident/incident-initiate.workflow.ts
 */
import { BaseBlueprint } from '@golden/core/workflow';
import { z } from '@golden/schema-registry';
import { runIncidentInitiate, type IncidentInitiateOutput } from './incident-initiate.logic.js';

export interface IncidentInitiateInput {
  title: string;
  severity: 'P1' | 'P2' | 'P3' | 'P4';
  slackChannel: string;
  summary?: string;
  /**
   * Optional explicit incident identifier; if omitted the workflow derives a stable ID from (sequence|uuid).
   */
  incidentId?: string;
  /**
   * Optional sequence to derive an incident id like INC-YYYY-###.
   */
  sequence?: number;
  notifyPagerDuty?: boolean;
  createStatuspageIncident?: boolean;
  pagerduty?: {
    serviceId?: string;
  };
  statuspage?: {
    pageId?: string;
  };
  slack?: {
    blocks?: unknown[];
  };
}

export class IncidentInitiateWorkflow extends BaseBlueprint<IncidentInitiateInput, IncidentInitiateOutput, object> {
  readonly metadata = {
    id: 'blueprints.incident.initiate',
    version: '1.0.0',
    name: 'Incident Initiate',
    description: 'Initiates an incident: announces in Slack and optionally creates PagerDuty/Statuspage incidents.',
    owner: 'platform',
    costCenter: 'CC-0',
    tags: ['incident', 'sre', 'operations'],
  };

  readonly security = {
    requiredRoles: ['incident-commander', 'sre-oncall'],
    classification: 'CONFIDENTIAL' as const,
  };

  readonly operations = {
    sla: { targetDuration: '15m', maxDuration: '1h' },
  };

  readonly inputSchema = z
    .object({
      title: z.string().min(1),
      severity: z.enum(['P1', 'P2', 'P3', 'P4']),
      slackChannel: z.string().min(1),
      summary: z.string().optional(),
      incidentId: z.string().optional(),
      sequence: z.number().int().positive().optional(),
      notifyPagerDuty: z.boolean().optional().default(false),
      createStatuspageIncident: z.boolean().optional().default(false),
      pagerduty: z.object({ serviceId: z.string().optional() }).optional(),
      statuspage: z.object({ pageId: z.string().optional() }).optional(),
      slack: z.object({ blocks: z.array(z.unknown()).optional() }).optional(),
    })
    .describe('Incident initiate input') as BaseBlueprint<IncidentInitiateInput, IncidentInitiateOutput, object>['inputSchema'];

  readonly configSchema = z.object({}).describe('No config') as BaseBlueprint<
    IncidentInitiateInput,
    IncidentInitiateOutput,
    object
  >['configSchema'];

  protected async logic(input: IncidentInitiateInput, _config: object): Promise<IncidentInitiateOutput> {
    void _config;
    return runIncidentInitiate(
      {
        executeById: (capId, capInput) => this.executeById(capId, capInput),
        nowMs: this.now,
        uuid: () => this.uuid(),
      },
      {
        ...input,
        notifyPagerDuty: Boolean(input.notifyPagerDuty),
        createStatuspageIncident: Boolean(input.createStatuspageIncident),
      }
    );
  }
}

