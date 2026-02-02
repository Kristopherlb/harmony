/**
 * packages/blueprints/src/workflows/incident/incident-remediate.logic.ts
 */
import type { IncidentSeverity } from '@golden/core';

export type RemediationKind = 'runbook';

export interface IncidentRemediateInput {
  incidentId: string;
  severity: IncidentSeverity;
  slackChannel: string;
  remediation: {
    kind: RemediationKind;
    path: string;
    cells?: string[];
    env?: Record<string, string>;
    timeout?: string;
    workdir?: string;
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

export interface IncidentRemediateOutput {
  status: 'COMPLETED' | 'REJECTED';
  approval: {
    wasRequired: boolean;
    wasApproved: boolean;
    reason?: string;
  };
  remediation: {
    executed: boolean;
    recordedInTimeline: boolean;
    runbook?: {
      success: boolean;
      message: string;
    };
  };
}

export interface IncidentRemediateDeps {
  executeById: <Out>(capId: string, input: unknown) => Promise<Out>;
  requestApproval: (reason: string) => Promise<{ approved: true } | { approved: false; reason?: string }>;
  nowMs: number;
}

function remediationReason(input: IncidentRemediateInput): string {
  return `[${input.severity}] ${input.incidentId}: approve remediation (${input.remediation.kind})`;
}

export async function runIncidentRemediate(
  deps: IncidentRemediateDeps,
  input: IncidentRemediateInput
): Promise<IncidentRemediateOutput> {
  // Notify start (non-sensitive).
  await deps.executeById('golden.connectors.slack', {
    operation: 'sendMessage',
    channel: input.slackChannel,
    text: `Starting remediation for ${input.incidentId} (${input.severity}).`,
  });

  // Approval gate before executing remediation actions.
  const approvalDecision = await deps.requestApproval(remediationReason(input));
  if (!approvalDecision.approved) {
    return {
      status: 'REJECTED',
      approval: { wasRequired: true, wasApproved: false, reason: approvalDecision.reason },
      remediation: { executed: false, recordedInTimeline: false },
    };
  }

  // Execute remediation runbook.
  const runbookResult = await deps.executeById<{
    success: boolean;
    message: string;
  }>('golden.operations.runme-runner', {
    source: input.remediation.path,
    sourceType: 'file',
    cells: input.remediation.cells,
    env: input.remediation.env,
    timeout: input.remediation.timeout,
    workdir: input.remediation.workdir,
  });

  // Optional kubectl step (kept explicit; call site can disable).
  if (input.kubectl?.enabled) {
    await deps.executeById('golden.commanders.kubectl', {
      operation: input.kubectl.operation,
      manifest: input.kubectl.manifest,
      resourceName: input.kubectl.resourceName,
      namespace: input.kubectl.namespace,
      context: input.kubectl.context,
      command: input.kubectl.command,
      container: input.kubectl.container,
      flags: input.kubectl.flags,
    });
  }

  // Notify result.
  await deps.executeById('golden.connectors.slack', {
    operation: 'sendMessage',
    channel: input.slackChannel,
    text: runbookResult.success
      ? `Remediation completed for ${input.incidentId}.`
      : `Remediation failed for ${input.incidentId}: ${runbookResult.message}`,
  });

  return {
    status: 'COMPLETED',
    approval: { wasRequired: true, wasApproved: true },
    remediation: {
      executed: true,
      recordedInTimeline: false,
      runbook: {
        success: runbookResult.success,
        message: runbookResult.message,
      },
    },
  };
}

