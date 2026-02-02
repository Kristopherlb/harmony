/**
 * packages/blueprints/src/workflows/incident/incident-initiate.logic.ts
 */
import type { IncidentSeverity } from '@golden/core';

export interface IncidentInitiateInput {
  title: string;
  severity: IncidentSeverity;
  slackChannel: string;
  summary?: string;
  incidentId?: string;
  sequence?: number;
  notifyPagerDuty: boolean;
  createStatuspageIncident: boolean;
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

export interface IncidentInitiateOutput {
  status: 'COMPLETED';
  incidentId: string;
  notifications: {
    slackAnnouncementPosted: boolean;
    pagerDutyIncidentCreated: boolean;
    statuspageIncidentCreated: boolean;
  };
  correlation: {
    slackChannel?: string;
    slackMessageTs?: string;
    pagerdutyIncidentId?: string;
    statuspageIncidentId?: string;
  };
}

export interface IncidentInitiateDeps {
  executeById: <Out>(capId: string, input: unknown) => Promise<Out>;
  nowMs: number;
  uuid: () => string;
}

function pad3(n: number): string {
  return String(n).padStart(3, '0');
}

function isHighUrgency(severity: IncidentSeverity): boolean {
  return severity === 'P1' || severity === 'P2';
}

function statuspageImpactForSeverity(severity: IncidentSeverity): 'critical' | 'major' | 'minor' | 'none' {
  switch (severity) {
    case 'P1':
      return 'critical';
    case 'P2':
      return 'major';
    case 'P3':
      return 'minor';
    case 'P4':
    default:
      return 'none';
  }
}

function inferIncidentId(input: IncidentInitiateInput, nowMs: number, uuid: () => string): string {
  if (input.incidentId) return input.incidentId;
  const year = new Date(nowMs).getUTCFullYear();
  if (typeof input.sequence === 'number' && Number.isFinite(input.sequence)) {
    return `INC-${year}-${pad3(input.sequence)}`;
  }
  const short = uuid().slice(0, 8);
  return `INC-${year}-${short}`;
}

export async function runIncidentInitiate(
  deps: IncidentInitiateDeps,
  input: IncidentInitiateInput
): Promise<IncidentInitiateOutput> {
  const incidentId = inferIncidentId(input, deps.nowMs, deps.uuid);
  const slackText = input.summary
    ? `[${input.severity}] ${incidentId}: ${input.title}\n${input.summary}`
    : `[${input.severity}] ${incidentId}: ${input.title}`;

  const slackResult = await deps.executeById<{ ok: boolean; channel?: string; ts?: string; error?: string }>(
    'golden.connectors.slack',
    {
      operation: 'sendMessage',
      channel: input.slackChannel,
      text: slackText,
      blocks: input.slack?.blocks,
    }
  );

  const correlation: IncidentInitiateOutput['correlation'] = {
    slackChannel: slackResult.channel,
    slackMessageTs: slackResult.ts,
  };

  let pagerDutyIncidentCreated = false;
  if (input.notifyPagerDuty) {
    const pd = await deps.executeById<{ success: boolean; incident?: { id?: string } }>('golden.connectors.pagerduty', {
      operation: 'create-incident',
      title: `[${input.severity}] ${incidentId}: ${input.title}`,
      description: input.summary ?? '',
      serviceId: input.pagerduty?.serviceId,
      urgency: isHighUrgency(input.severity) ? 'high' : 'low',
    });
    pagerDutyIncidentCreated = Boolean(pd.success);
    correlation.pagerdutyIncidentId = pd.incident?.id;
  }

  let statuspageIncidentCreated = false;
  if (input.createStatuspageIncident) {
    const sp = await deps.executeById<{ success: boolean; incident?: { id?: string } }>('golden.connectors.statuspage', {
      operation: 'create-incident',
      pageId: input.statuspage?.pageId,
      name: `[${input.severity}] ${incidentId}: ${input.title}`,
      status: 'investigating',
      impact: statuspageImpactForSeverity(input.severity),
      body: slackText,
      deliverNotifications: true,
    });
    statuspageIncidentCreated = Boolean(sp.success);
    correlation.statuspageIncidentId = sp.incident?.id;
  }

  return {
    status: 'COMPLETED',
    incidentId,
    notifications: {
      slackAnnouncementPosted: Boolean(slackResult.ok),
      pagerDutyIncidentCreated,
      statuspageIncidentCreated,
    },
    correlation,
  };
}

