/**
 * server/integrations/http/slack-approver-policy.ts
 *
 * Purpose: Resolve Slack approver roles deterministically in the Console server.
 *
 * Rationale:
 * - Slack interactive callbacks are not authenticated via OIDC.
 * - `BaseBlueprint.waitForApproval({ requiredRoles })` authorizes approvals by checking
 *   `ApprovalSignalPayload.approverRoles`.
 * - Until Slack→IdP role mapping exists, we use a repo-root policy file to map Slack user IDs
 *   to approver roles.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import * as core from '@golden/core';
import type { ApprovalSignalPayload } from '@golden/core/workflow';
import { unwrapCjsNamespace } from '../../lib/cjs-interop';

const corePkg = unwrapCjsNamespace<typeof core>(core as any);

export interface SlackApproverPolicy {
  version: '1.0.0';
  users: Record<
    string,
    {
      /** Roles to attach to ApprovalSignalPayload.approverRoles */
      roles: string[];
      /** Optional stable internal id for audit trails */
      approverId?: string;
      /** Optional display name for audit trails */
      approverName?: string;
    }
  >;
}

export function getDefaultSlackApproverPolicyPath(): string {
  return path.join((corePkg as any).getRepoRoot(), 'policies', 'slack-approvers.json');
}

export function loadSlackApproverPolicy(
  policyPath: string = getDefaultSlackApproverPolicyPath()
): SlackApproverPolicy | null {
  try {
    const raw = readFileSync(policyPath, 'utf8');
    const parsed = JSON.parse(raw) as SlackApproverPolicy;

    if (parsed?.version !== '1.0.0' || typeof parsed.users !== 'object' || parsed.users === null) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function resolveApproverFromSlackUserId(params: {
  slackUserId: string;
  policy?: SlackApproverPolicy | null;
}): { approverRoles: string[]; approverId?: string; approverName?: string } {
  const entry = params.policy?.users?.[params.slackUserId];
  if (!entry) {
    return { approverRoles: [] };
  }

  const roles = Array.isArray(entry.roles) ? entry.roles.filter((r) => typeof r === 'string') : [];
  return {
    approverRoles: roles,
    approverId: typeof entry.approverId === 'string' ? entry.approverId : undefined,
    approverName: typeof entry.approverName === 'string' ? entry.approverName : undefined,
  };
}

export function buildSlackApprovalSignalPayload(params: {
  decision: 'approved' | 'rejected';
  slackUserId: string;
  slackUserName?: string;
  slackUserUsername?: string;
  policy?: SlackApproverPolicy | null;
  reason?: string;
  timestamp: string;
}): ApprovalSignalPayload {
  const resolved = resolveApproverFromSlackUserId({
    slackUserId: params.slackUserId,
    policy: params.policy,
  });

  return {
    decision: params.decision,
    approverId: resolved.approverId ?? params.slackUserId,
    approverName:
      resolved.approverName ??
      params.slackUserName ??
      params.slackUserUsername ??
      params.slackUserId,
    approverRoles: resolved.approverRoles,
    reason: params.reason,
    timestamp: params.timestamp,
    source: 'slack',
  };
}

