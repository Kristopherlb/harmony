/**
 * packages/blueprints/src/activities/approval-activities.ts
 * Approval notification activities for HITL infrastructure.
 *
 * These activities handle sending and updating approval request notifications
 * via Slack. They are called from BaseBlueprint.waitForApproval().
 */
import type { ApprovalNotificationActivity, ApprovalSignalPayload } from '@golden/core/workflow';
import { createApprovalBlocks, createApprovalResultBlocks } from '@golden/core/workflow';

/**
 * Create the approval notification activities.
 * This is registered with the Temporal worker.
 *
 * @param config - Configuration for the activities
 */
export function createApprovalActivities(config?: {
  slackBotToken?: string;
  slackBotTokenPath?: string;
}): ApprovalNotificationActivity {
  // Get Slack token from config or environment
  const getSlackToken = (): string => {
    if (config?.slackBotToken) {
      return config.slackBotToken;
    }
    if (config?.slackBotTokenPath) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require('fs');
      return fs.readFileSync(config.slackBotTokenPath, 'utf8').trim();
    }
    const envToken = process.env.SLACK_BOT_TOKEN;
    if (envToken) {
      return envToken;
    }
    throw new Error('Slack bot token not configured. Set SLACK_BOT_TOKEN or provide via config.');
  };

  return {
    async sendApprovalRequestToSlack(params): Promise<{ messageTs: string }> {
      const token = getSlackToken();

      // Create Block Kit blocks for approval request
      const blocks = createApprovalBlocks({
        workflowId: params.workflowId,
        reason: params.reason,
        requiredRoles: params.requiredRoles,
        timeout: params.timeout,
        requestedBy: params.requestedBy,
        incidentId: params.incidentId,
        incidentSeverity: params.incidentSeverity,
      });

      // Send message to Slack
      const response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel: params.channel,
          blocks,
          text: `🔐 Approval Required: ${params.reason}`, // Fallback text
        }),
      });

      const result = await response.json() as {
        ok: boolean;
        ts?: string;
        error?: string;
      };

      if (!result.ok) {
        throw new Error(`Failed to send Slack message: ${result.error}`);
      }

      return { messageTs: result.ts ?? '' };
    },

    async updateApprovalMessage(params): Promise<void> {
      const token = getSlackToken();

      // Create updated Block Kit blocks
      const blocks = createApprovalResultBlocks({
        originalReason: params.originalReason,
        decision: params.decision,
        durationMs: params.durationMs,
      });

      // Update the original message
      const response = await fetch('https://slack.com/api/chat.update', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel: params.channel,
          ts: params.messageTs,
          blocks,
          text: `${params.decision.decision === 'approved' ? '✅' : '❌'} ${params.decision.decision.toUpperCase()}: ${params.originalReason}`,
        }),
      });

      const result = await response.json() as {
        ok: boolean;
        error?: string;
      };

      if (!result.ok) {
        // Don't throw for update failures - it's not critical
        console.warn(`Failed to update Slack message: ${result.error}`);
      }
    },
  };
}

/**
 * Create mock approval activities for testing.
 * Records all calls for verification in tests.
 */
export function createMockApprovalActivities(): ApprovalNotificationActivity & {
  calls: {
    sendApprovalRequest: Parameters<ApprovalNotificationActivity['sendApprovalRequestToSlack']>[];
    updateApprovalMessage: Parameters<ApprovalNotificationActivity['updateApprovalMessage']>[];
  };
  setMockMessageTs: (ts: string) => void;
} {
  let mockMessageTs = 'mock-ts-123';

  const activities = {
    calls: {
      sendApprovalRequest: [] as Parameters<ApprovalNotificationActivity['sendApprovalRequestToSlack']>[],
      updateApprovalMessage: [] as Parameters<ApprovalNotificationActivity['updateApprovalMessage']>[],
    },

    setMockMessageTs(ts: string) {
      mockMessageTs = ts;
    },

    async sendApprovalRequestToSlack(
      params: Parameters<ApprovalNotificationActivity['sendApprovalRequestToSlack']>[0]
    ): Promise<{ messageTs: string }> {
      activities.calls.sendApprovalRequest.push([params]);
      return { messageTs: mockMessageTs };
    },

    async updateApprovalMessage(
      params: Parameters<ApprovalNotificationActivity['updateApprovalMessage']>[0]
    ): Promise<void> {
      activities.calls.updateApprovalMessage.push([params]);
    },
  };

  return activities;
}
