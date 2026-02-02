/**
 * packages/blueprints/src/workflows/incident/incident-post-mortem.logic.ts
 */
import type { IncidentSeverity } from '@golden/core';

export interface IncidentPostMortemInput {
  incidentId: string;
  severity: IncidentSeverity;
  slackChannel: string;
  title: string;
  confluence: {
    spaceKey: string;
    parentId?: string;
    labels?: string[];
  };
}

export interface IncidentPostMortemOutput {
  status: 'COMPLETED' | 'REJECTED';
  approval: {
    wasRequired: boolean;
    wasApproved: boolean;
    reason?: string;
  };
  postmortem: {
    confluencePageCreated: boolean;
    pageUrl?: string;
  };
}

export interface IncidentPostMortemDeps {
  executeById: <Out>(capId: string, input: unknown) => Promise<Out>;
  requestApproval: (reason: string) => Promise<{ approved: true } | { approved: false; reason?: string }>;
}

function postMortemReason(input: IncidentPostMortemInput): string {
  return `[${input.severity}] ${input.incidentId}: approve post-mortem publish`;
}

function buildConfluenceBody(input: IncidentPostMortemInput): string {
  // Storage format (XHTML) keeps Confluence rendering deterministic.
  return [
    `<h1>Incident Summary</h1>`,
    `<p><strong>Incident:</strong> ${input.incidentId}</p>`,
    `<p><strong>Severity:</strong> ${input.severity}</p>`,
    `<p><strong>Title:</strong> ${escapeHtml(input.title)}</p>`,
    `<h2>Timeline</h2>`,
    `<p>TODO: Populate from incident timeline events.</p>`,
    `<h2>Root Cause</h2>`,
    `<p>TODO</p>`,
    `<h2>Resolution</h2>`,
    `<p>TODO</p>`,
    `<h2>Action Items</h2>`,
    `<ul><li>TODO</li></ul>`,
  ].join('\n');
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export async function runIncidentPostMortem(
  deps: IncidentPostMortemDeps,
  input: IncidentPostMortemInput
): Promise<IncidentPostMortemOutput> {
  const approvalDecision = await deps.requestApproval(postMortemReason(input));
  if (!approvalDecision.approved) {
    return {
      status: 'REJECTED',
      approval: { wasRequired: true, wasApproved: false, reason: approvalDecision.reason },
      postmortem: { confluencePageCreated: false },
    };
  }

  const confluenceResult = await deps.executeById<{
    success: boolean;
    page?: { id?: string; webUrl?: string };
    message?: string;
  }>('golden.connectors.confluence', {
    operation: 'create-page',
    spaceKey: input.confluence.spaceKey,
    parentId: input.confluence.parentId,
    title: input.title,
    body: buildConfluenceBody(input),
    bodyFormat: 'storage',
    labels: input.confluence.labels,
  });

  const pageUrl = confluenceResult.page?.webUrl;
  if (pageUrl) {
    await deps.executeById('golden.connectors.slack', {
      operation: 'sendMessage',
      channel: input.slackChannel,
      text: `Post-mortem created for ${input.incidentId}: ${pageUrl}`,
    });
  }

  return {
    status: 'COMPLETED',
    approval: { wasRequired: true, wasApproved: true },
    postmortem: { confluencePageCreated: Boolean(confluenceResult.success), pageUrl },
  };
}

