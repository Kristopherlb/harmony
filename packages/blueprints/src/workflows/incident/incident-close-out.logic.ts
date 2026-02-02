/**
 * packages/blueprints/src/workflows/incident/incident-close-out.logic.ts
 */
import type { IncidentSeverity } from '@golden/core';

export interface IncidentCloseOutInput {
  incidentId: string;
  severity: IncidentSeverity;
  slackChannel: string;
  resolutionSummary: string;
  correlation: {
    pagerdutyIncidentId?: string;
    statuspageIncidentId?: string;
    statuspagePageId?: string;
  };
}

export interface IncidentCloseOutOutput {
  status: 'COMPLETED' | 'REJECTED';
  approval: {
    wasRequired: boolean;
    wasApproved: boolean;
    reason?: string;
  };
  notifications: {
    statuspageIncidentResolved: boolean;
    pagerDutyIncidentResolved: boolean;
    slackCloseoutPosted: boolean;
  };
}

export interface IncidentCloseOutDeps {
  executeById: <Out>(capId: string, input: unknown) => Promise<Out>;
  requestApproval: (reason: string) => Promise<{ approved: true } | { approved: false; reason?: string }>;
}

function closeOutReason(input: IncidentCloseOutInput): string {
  return `[${input.severity}] ${input.incidentId}: approve close-out`;
}

export async function runIncidentCloseOut(
  deps: IncidentCloseOutDeps,
  input: IncidentCloseOutInput
): Promise<IncidentCloseOutOutput> {
  // Always post a close-out message (non-sensitive); includes resolution summary.
  const slack = await deps.executeById<{ ok?: boolean }>('golden.connectors.slack', {
    operation: 'sendMessage',
    channel: input.slackChannel,
    text: `Close-out requested for ${input.incidentId} (${input.severity}).\n${input.resolutionSummary}`,
  });

  const approvalDecision = await deps.requestApproval(closeOutReason(input));
  if (!approvalDecision.approved) {
    return {
      status: 'REJECTED',
      approval: { wasRequired: true, wasApproved: false, reason: approvalDecision.reason },
      notifications: {
        statuspageIncidentResolved: false,
        pagerDutyIncidentResolved: false,
        slackCloseoutPosted: Boolean(slack.ok ?? true),
      },
    };
  }

  let statuspageIncidentResolved = false;
  if (input.correlation.statuspageIncidentId) {
    const sp = await deps.executeById<{ success?: boolean }>('golden.connectors.statuspage', {
      operation: 'resolve-incident',
      pageId: input.correlation.statuspagePageId,
      incidentId: input.correlation.statuspageIncidentId,
    });
    statuspageIncidentResolved = Boolean(sp.success ?? true);
  }

  let pagerDutyIncidentResolved = false;
  if (input.correlation.pagerdutyIncidentId) {
    const pd = await deps.executeById<{ success?: boolean }>('golden.connectors.pagerduty', {
      operation: 'resolve-incident',
      incidentId: input.correlation.pagerdutyIncidentId,
    });
    pagerDutyIncidentResolved = Boolean(pd.success ?? true);
  }

  return {
    status: 'COMPLETED',
    approval: { wasRequired: true, wasApproved: true },
    notifications: {
      statuspageIncidentResolved,
      pagerDutyIncidentResolved,
      slackCloseoutPosted: Boolean(slack.ok ?? true),
    },
  };
}

