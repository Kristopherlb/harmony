/**
 * server/integrations/http/slack-interactive-handler.ts
 * Handler for Slack interactive payloads (button clicks, modal submissions).
 *
 * This handler processes approval button clicks from Slack and sends
 * approval signals to the appropriate Temporal workflows.
 */
import type { Request, Response } from 'express';
import { Client, Connection } from '@temporalio/client';
import * as coreWorkflow from '@golden/core/workflow';
import type { ApprovalSignalPayload } from '@golden/core/workflow';
import { buildSlackApprovalSignalPayload, loadSlackApproverPolicy } from './slack-approver-policy';
import { unwrapCjsNamespace } from '../../lib/cjs-interop';

const coreWorkflowPkg = unwrapCjsNamespace<typeof coreWorkflow>(coreWorkflow as any);

/**
 * Slack interactive payload structure.
 * Slack sends this as a URL-encoded 'payload' field.
 */
interface SlackInteractivePayload {
  type: 'block_actions' | 'view_submission' | 'view_closed';
  user: {
    id: string;
    username: string;
    name: string;
  };
  api_app_id: string;
  token: string;
  trigger_id: string;
  response_url: string;
  actions?: Array<{
    type: string;
    action_id: string;
    block_id: string;
    value: string;
    action_ts: string;
  }>;
  container?: {
    type: string;
    message_ts: string;
    channel_id: string;
  };
  channel?: {
    id: string;
    name: string;
  };
  message?: {
    ts: string;
    text: string;
  };
}

/**
 * Configuration for the Slack interactive handler.
 */
export interface SlackInteractiveHandlerConfig {
  /** Temporal server address. Default: localhost:7233 */
  temporalAddress?: string;
  /** Temporal namespace. Default: default */
  temporalNamespace?: string;
  /** Slack signing secret for verification. */
  slackSigningSecret?: string;
  /**
   * Path to Slack approver policy JSON.
   * Default: `<repoRoot>/policies/slack-approvers.json`
   */
  slackApproverPolicyPath?: string;
}

// Singleton Temporal client
let temporalClient: Client | null = null;

async function getTemporalClient(config: SlackInteractiveHandlerConfig): Promise<Client> {
  if (!temporalClient) {
    const connection = await Connection.connect({
      address: config.temporalAddress ?? process.env.TEMPORAL_ADDRESS ?? 'localhost:7233',
    });
    temporalClient = new Client({
      connection,
      namespace: config.temporalNamespace ?? process.env.TEMPORAL_NAMESPACE ?? 'default',
    });
  }
  return temporalClient;
}

/**
 * Create the Slack interactive handler.
 *
 * @param config - Handler configuration
 * @returns Express request handler
 */
export function createSlackInteractiveHandler(config: SlackInteractiveHandlerConfig = {}) {
  return async function slackInteractiveHandler(req: Request, res: Response): Promise<Response> {
    try {
      const policy = loadSlackApproverPolicy(config.slackApproverPolicyPath);

      // Slack sends the payload as a URL-encoded 'payload' field
      const rawPayload = req.body.payload;
      if (!rawPayload) {
        return res.status(400).json({ error: 'Missing payload' });
      }

      const payload: SlackInteractivePayload = JSON.parse(rawPayload);

      // Only handle block_actions (button clicks)
      if (payload.type !== 'block_actions') {
        return res.status(200).json({ ok: true });
      }

      const actions = payload.actions ?? [];
      if (actions.length === 0) {
        return res.status(200).json({ ok: true });
      }

      // Process each action (usually just one)
      for (const action of actions) {
        // Check if this is an approval action
        const isApprove = action.action_id === (coreWorkflowPkg as any).APPROVAL_ACTION_IDS.APPROVE;
        const isReject = action.action_id === (coreWorkflowPkg as any).APPROVAL_ACTION_IDS.REJECT;

        if (!isApprove && !isReject) {
          // Not an approval action - ignore
          continue;
        }

        // The workflow ID is stored in the button value
        const workflowId = action.value;
        if (!workflowId) {
          console.warn('Approval action missing workflow ID');
          continue;
        }

        // Build the approval signal payload
        const signalPayload: ApprovalSignalPayload = buildSlackApprovalSignalPayload({
          decision: isApprove ? 'approved' : 'rejected',
          slackUserId: payload.user.id,
          slackUserName: payload.user.name,
          slackUserUsername: payload.user.username,
          policy,
          timestamp: new Date().toISOString(),
        });

        // If rejecting, prompt for reason (for now, just use a default)
        // In the future, we could open a modal to get the reason
        if (isReject) {
          signalPayload.reason = 'Rejected via Slack';
        }

        try {
          // Send the approval signal to the workflow
          const client = await getTemporalClient(config);
          const handle = client.workflow.getHandle(workflowId);
          await handle.signal((coreWorkflowPkg as any).approvalSignal, signalPayload);

          console.log(
            `[SlackInteractive] Sent ${signalPayload.decision} signal to workflow ${workflowId} from ${payload.user.username}`
          );
        } catch (err) {
          console.error(`[SlackInteractive] Failed to signal workflow ${workflowId}:`, err);

          // Send error response back to Slack
          return res.json({
            response_type: 'ephemeral',
            replace_original: false,
            text: `❌ Failed to process approval: ${(err as Error).message}`,
          });
        }
      }

      // Acknowledge the interaction (Slack expects a 200 within 3 seconds)
      // The actual message update will be done by the workflow via activities
      return res.status(200).json({ ok: true });
    } catch (error) {
      console.error('[SlackInteractive] Error processing interactive payload:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };
}

/**
 * Middleware to verify Slack request signature.
 * Should be applied before the interactive handler.
 */
export function createSlackVerificationMiddleware(signingSecret: string) {
  return async function verifySlackSignature(
    req: Request,
    res: Response,
    next: () => void
  ): Promise<Response | void> {
    const timestamp = req.headers['x-slack-request-timestamp'] as string;
    const signature = req.headers['x-slack-signature'] as string;

    if (!timestamp || !signature) {
      return res.status(401).json({ error: 'Missing Slack signature headers' });
    }

    // Check timestamp is within 5 minutes to prevent replay attacks
    const requestTime = parseInt(timestamp, 10);
    const currentTime = Math.floor(Date.now() / 1000);
    if (Math.abs(currentTime - requestTime) > 300) {
      return res.status(401).json({ error: 'Request timestamp too old' });
    }

    // Compute expected signature
    const crypto = await import('crypto');
    const sigBasestring = `v0:${timestamp}:${req.rawBody ?? JSON.stringify(req.body)}`;
    const expectedSignature = `v0=${crypto
      .createHmac('sha256', signingSecret)
      .update(sigBasestring)
      .digest('hex')}`;

    // Compare signatures using timing-safe comparison
    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (
      signatureBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
      return res.status(401).json({ error: 'Invalid Slack signature' });
    }

    next();
  };
}

// Extend Express Request type to include rawBody
declare global {
  namespace Express {
    interface Request {
      rawBody?: string;
    }
  }
}
