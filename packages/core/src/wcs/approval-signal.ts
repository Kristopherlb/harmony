/**
 * packages/core/src/wcs/approval-signal.ts
 * HITL Approval Signal Infrastructure (AIP/AECS compliant)
 *
 * Defines Temporal signals and queries for human-in-the-loop approval gates.
 * Used by blueprints that require human approval before proceeding with
 * sensitive operations.
 */
import { defineSignal, defineQuery } from '@temporalio/workflow';

// ─────────────────────────────────────────────────────────────────────────────
// Signal Types
// ─────────────────────────────────────────────────────────────────────────────

/** Decision outcome for approval. */
export type ApprovalDecision = 'approved' | 'rejected';

/** Payload sent with approval signal. */
export interface ApprovalSignalPayload {
  /** The decision made by the approver. */
  decision: ApprovalDecision;
  /** ID of the user who made the decision. */
  approverId: string;
  /** Display name of the approver (for audit). */
  approverName?: string;
  /** Roles held by the approver at time of decision. */
  approverRoles: string[];
  /** Optional reason for the decision (especially for rejections). */
  reason?: string;
  /** ISO timestamp when decision was made. */
  timestamp: string;
  /** Source of the approval (console, slack, api). */
  source: 'console' | 'slack' | 'api';
}

// ─────────────────────────────────────────────────────────────────────────────
// Signal Definition
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Signal to send approval or rejection to a waiting workflow.
 * Signal name: 'approval'
 */
export const approvalSignal = defineSignal<[ApprovalSignalPayload]>('approval');

// ─────────────────────────────────────────────────────────────────────────────
// Query Types
// ─────────────────────────────────────────────────────────────────────────────

/** Status of an approval request. */
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'timeout' | 'cancelled';

/** Current state of an approval request, queryable by external systems. */
export interface ApprovalState {
  /** Current status of the approval request. */
  status: ApprovalStatus;
  /** ISO timestamp when approval was requested. */
  requestedAt: string;
  /** Reason/context for why approval is needed. */
  requestReason: string;
  /** Required roles to approve (any role is sufficient). */
  requiredRoles: string[];
  /** Timeout duration for the approval request. */
  timeout: string;
  /** The decision details if already decided. */
  decision?: ApprovalSignalPayload;
  /** Workflow ID for reference. */
  workflowId: string;
  /** Slack message timestamp for updating after decision. */
  slackMessageTs?: string;
  /** Slack channel where approval was requested. */
  slackChannel?: string;
}

/**
 * Query to get current approval state from a workflow.
 * Query name: 'approvalState'
 */
export const approvalStateQuery = defineQuery<ApprovalState>('approvalState');

// ─────────────────────────────────────────────────────────────────────────────
// Request Types
// ─────────────────────────────────────────────────────────────────────────────

/** Parameters for requesting approval within a blueprint. */
export interface ApprovalRequestParams {
  /** Human-readable reason why approval is needed. */
  reason: string;
  /** Roles authorized to approve (empty = any authenticated user). */
  requiredRoles?: string[];
  /** Timeout duration (e.g., '30m', '1h'). Default: '1h'. */
  timeout?: string;
  /** Slack channel to send approval request to. */
  notifySlackChannel?: string;
  /** Custom message for Slack notification. */
  notifyMessage?: string;
  /** Additional context to include in approval request. */
  context?: Record<string, unknown>;
}

/** Result returned from waitForApproval. */
export interface ApprovalResult {
  /** Whether the request was approved. */
  approved: boolean;
  /** The full decision payload. */
  decision: ApprovalSignalPayload;
  /** How long the approval took in milliseconds. */
  durationMs: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Error Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Error thrown when approval times out.
 */
export class ApprovalTimeoutError extends Error {
  constructor(
    public readonly workflowId: string,
    public readonly timeout: string,
    public readonly requestReason: string
  ) {
    super(`Approval request timed out after ${timeout}: ${requestReason}`);
    this.name = 'ApprovalTimeoutError';
  }
}

/**
 * Error thrown when approval is rejected.
 */
export class ApprovalRejectedError extends Error {
  constructor(
    public readonly decision: ApprovalSignalPayload
  ) {
    super(`Approval rejected by ${decision.approverId}: ${decision.reason ?? 'No reason provided'}`);
    this.name = 'ApprovalRejectedError';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Slack Block Kit Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Block Kit action IDs for approval buttons. */
export const APPROVAL_ACTION_IDS = {
  APPROVE: 'approval_approve',
  REJECT: 'approval_reject',
} as const;

/**
 * Create Slack Block Kit blocks for an approval request message.
 */
export function createApprovalBlocks(params: {
  workflowId: string;
  reason: string;
  requiredRoles: string[];
  timeout: string;
  requestedBy: string;
  incidentId?: string;
  incidentSeverity?: string;
}): unknown[] {
  const blocks: unknown[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '🔐 Approval Required',
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Reason:* ${params.reason}`,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Requested by:*\n${params.requestedBy}`,
        },
        {
          type: 'mrkdwn',
          text: `*Timeout:*\n${params.timeout}`,
        },
      ],
    },
  ];

  // Add incident context if present
  if (params.incidentId) {
    blocks.push({
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Incident:*\n${params.incidentId}`,
        },
        {
          type: 'mrkdwn',
          text: `*Severity:*\n${params.incidentSeverity ?? 'Unknown'}`,
        },
      ],
    });
  }

  // Add required roles if specified
  if (params.requiredRoles.length > 0) {
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Required roles: ${params.requiredRoles.join(', ')}`,
        },
      ],
    });
  }

  // Add approve/reject buttons
  blocks.push({
    type: 'actions',
    block_id: `approval_${params.workflowId}`,
    elements: [
      {
        type: 'button',
        text: {
          type: 'plain_text',
          text: '✅ Approve',
          emoji: true,
        },
        style: 'primary',
        action_id: APPROVAL_ACTION_IDS.APPROVE,
        value: params.workflowId,
      },
      {
        type: 'button',
        text: {
          type: 'plain_text',
          text: '❌ Reject',
          emoji: true,
        },
        style: 'danger',
        action_id: APPROVAL_ACTION_IDS.REJECT,
        value: params.workflowId,
      },
    ],
  });

  return blocks;
}

/**
 * Create Slack blocks for approval decision confirmation.
 */
export function createApprovalResultBlocks(params: {
  originalReason: string;
  decision: ApprovalSignalPayload;
  durationMs: number;
}): unknown[] {
  const emoji = params.decision.decision === 'approved' ? '✅' : '❌';
  const status = params.decision.decision === 'approved' ? 'Approved' : 'Rejected';
  const durationStr = params.durationMs > 60000
    ? `${Math.round(params.durationMs / 60000)}m`
    : `${Math.round(params.durationMs / 1000)}s`;

  return [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${emoji} ${status}`,
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Original request:* ${params.originalReason}`,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*${status} by:*\n${params.decision.approverName ?? params.decision.approverId}`,
        },
        {
          type: 'mrkdwn',
          text: `*Response time:*\n${durationStr}`,
        },
      ],
    },
    ...(params.decision.reason
      ? [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Reason:* ${params.decision.reason}`,
            },
          },
        ]
      : []),
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Source: ${params.decision.source} | ${params.decision.timestamp}`,
        },
      ],
    },
  ];
}
