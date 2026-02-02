/**
 * packages/capabilities/src/integrations/slack-interactive.capability.ts
 * Slack Interactive Capability (OCS Commander Pattern)
 *
 * Purpose: wrap Slack interactive operations (approval messages, result updates, modals, and interaction responses)
 * in a single OCS capability, with ISS-compliant secret mounting.
 */
import { z } from '@golden/schema-registry';
import type { Capability, CapabilityContext } from '@golden/core';

const operationSchema = z.enum([
  'send-approval-request',
  'update-message-with-result',
  'open-modal',
  'respond-to-interaction',
]);

const blockSchema = z.record(z.unknown()).describe('Slack Block Kit block');

const workflowContextSchema = z
  .object({
    workflowId: z.string().min(1),
    approvalReason: z.string().min(1),
    requiredRoles: z.array(z.string()).default([]),
    timeout: z.string().default('1h'),
  })
  .partial()
  .describe('Optional workflow context for tracking/audit');

const inputSchema = z
  .object({
    operation: operationSchema.describe('Slack interactive operation'),
    channel: z.string().optional().describe('Slack channel ID or name'),
    messageTs: z.string().optional().describe('Slack message timestamp (ts)'),
    triggerId: z.string().optional().describe('Slack trigger_id (for opening modals)'),
    responseUrl: z.string().url().optional().describe('Slack response_url (for direct interaction responses)'),
    text: z.string().optional().describe('Fallback/primary text content'),
    replaceOriginal: z.boolean().optional().describe('Whether to replace original message (response_url)'),
    blocks: z.array(blockSchema).optional().describe('Slack Block Kit blocks'),
    workflowContext: workflowContextSchema.optional(),
  })
  .describe('slackInteractive input');

const outputSchema = z
  .object({
    success: z.boolean().describe('Whether the operation succeeded'),
    messageTs: z.string().optional().describe('Message timestamp (for send/update)'),
    error: z.string().optional().describe('Error message if failed'),
  })
  .describe('slackInteractive output');

const configSchema = z
  .object({
    defaultChannel: z.string().optional().describe('Default channel for messages'),
    defaultModalTitle: z.string().optional().describe('Default title for generated modals'),
    defaultModalSubmit: z.string().optional().describe('Default submit label for generated modals'),
    defaultModalClose: z.string().optional().describe('Default close label for generated modals'),
  })
  .describe('slackInteractive config');

// Secrets schema declares keys only; platform passes secret refs in context.secretRefs.
const secretsSchema = z
  .object({
    botToken: z.string().optional().describe('Secret ref/path for Slack Bot User OAuth Token (xoxb-...)'),
  })
  .describe('slackInteractive secrets (keys only)');

export type SlackInteractiveInput = z.infer<typeof inputSchema>;
export type SlackInteractiveOutput = z.infer<typeof outputSchema>;
export type SlackInteractiveConfig = z.infer<typeof configSchema>;
export type SlackInteractiveSecrets = z.infer<typeof secretsSchema>;

export const slackInteractiveCapability: Capability<
  SlackInteractiveInput,
  SlackInteractiveOutput,
  SlackInteractiveConfig,
  SlackInteractiveSecrets
> = {
  metadata: {
    id: 'golden.integrations.slack-interactive',
    version: '1.0.0',
    name: 'slackInteractive',
    description:
      'Slack interactive operations: send approval request messages, update messages with results, open modals, and respond to interactions.',
    domain: 'integrations',
    tags: ['integrations', 'slack', 'interactive', 'commander'],
    maintainer: 'platform',
  },
  schemas: {
    input: inputSchema,
    output: outputSchema,
    config: configSchema,
    secrets: secretsSchema,
  },
  security: {
    requiredScopes: ['slack:write'],
    dataClassification: 'INTERNAL',
    networkAccess: {
      allowOutbound: ['slack.com', 'api.slack.com'],
    },
  },
  operations: {
    isIdempotent: false,
    retryPolicy: { maxAttempts: 3, initialIntervalSeconds: 1, backoffCoefficient: 2 },
    errorMap: (error: unknown) => {
      if (error instanceof Error && error.message.includes('rate_limited')) return 'RETRYABLE';
      return 'FATAL';
    },
    costFactor: 'LOW',
  },
  aiHints: {
    exampleInput: {
      operation: 'send-approval-request',
      channel: '#deployments',
      text: '🔐 Approval Required',
      blocks: [
        {
          type: 'section',
          text: { type: 'mrkdwn', text: '*Reason:* Deploy v1.2.3 to production' },
        },
      ],
      workflowContext: {
        workflowId: 'wf-123',
        approvalReason: 'Deploy to prod',
        requiredRoles: ['sre'],
        timeout: '30m',
      },
    },
    exampleOutput: {
      success: true,
      messageTs: '1234567890.123456',
    },
    usageNotes:
      'Prefer passing channel IDs (C...) for reliability. For response_url operations, provide responseUrl and optional replaceOriginal.',
  },
  factory: (
    dag,
    context: CapabilityContext<SlackInteractiveConfig, SlackInteractiveSecrets>,
    input: SlackInteractiveInput
  ) => {
    type DaggerSecret = unknown;
    type ContainerBuilder = {
      from(image: string): ContainerBuilder;
      withEnvVariable(key: string, value: string): ContainerBuilder;
      withMountedSecret(path: string, secret: DaggerSecret): ContainerBuilder;
      withExec(args: string[]): unknown;
    };
    type DaggerClient = { container(): ContainerBuilder };
    const d = dag as unknown as DaggerClient;

    const payload = {
      operation: input.operation,
      channel: input.channel ?? context.config.defaultChannel ?? '',
      messageTs: input.messageTs,
      triggerId: input.triggerId,
      responseUrl: input.responseUrl,
      text: input.text ?? '',
      replaceOriginal: input.replaceOriginal ?? false,
      blocks: input.blocks ?? [],
      workflowContext: input.workflowContext ?? {},
      modal: {
        title: context.config.defaultModalTitle ?? 'Action Required',
        submit: context.config.defaultModalSubmit ?? 'Submit',
        close: context.config.defaultModalClose ?? 'Cancel',
      },
    };

    let container = d.container().from('node:20-alpine').withEnvVariable('INPUT_JSON', JSON.stringify(payload));

    if (context.secretRefs.botToken && typeof (container as Record<string, unknown>).withMountedSecret === 'function') {
      container = container.withMountedSecret('/run/secrets/bot_token', context.secretRefs.botToken as unknown as DaggerSecret);
    }

    return container.withExec([
      'sh',
      '-c',
      `
node -e '
const fs = require("fs");
const input = JSON.parse(process.env.INPUT_JSON);

function readToken() {
  const p = "/run/secrets/bot_token";
  if (fs.existsSync(p)) return fs.readFileSync(p, "utf8").trim();
  return null;
}

async function slackApi(method, body) {
  const token = readToken();
  if (!token) throw new Error("Slack bot token not mounted at /run/secrets/bot_token");
  const res = await fetch("https://slack.com/api/" + method, {
    method: "POST",
    headers: {
      authorization: "Bearer " + token,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({ ok: false, error: "invalid_json" }));
  if (!json.ok) throw new Error(json.error || "slack_api_error");
  return json;
}

async function respondToInteraction() {
  if (!input.responseUrl) throw new Error("responseUrl is required");
  const body = {
    response_type: "ephemeral",
    replace_original: Boolean(input.replaceOriginal),
    text: input.text || undefined,
    blocks: Array.isArray(input.blocks) && input.blocks.length ? input.blocks : undefined,
  };
  const res = await fetch(input.responseUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("response_url request failed: " + res.status);
  return { success: true };
}

async function run() {
  if (input.operation === "respond-to-interaction") {
    const out = await respondToInteraction();
    process.stdout.write(JSON.stringify(out));
    return;
  }

  if (input.operation === "send-approval-request") {
    const r = await slackApi("chat.postMessage", {
      channel: input.channel,
      text: input.text || "Approval required",
      blocks: input.blocks,
    });
    process.stdout.write(JSON.stringify({ success: Boolean(r.ok), messageTs: r.ts, error: r.error }));
    return;
  }

  if (input.operation === "update-message-with-result") {
    const r = await slackApi("chat.update", {
      channel: input.channel,
      ts: input.messageTs,
      text: input.text || "Update",
      blocks: input.blocks,
    });
    process.stdout.write(JSON.stringify({ success: Boolean(r.ok), messageTs: r.ts, error: r.error }));
    return;
  }

  if (input.operation === "open-modal") {
    if (!input.triggerId) throw new Error("triggerId is required");
    const view = {
      type: "modal",
      title: { type: "plain_text", text: input.modal.title, emoji: true },
      submit: { type: "plain_text", text: input.modal.submit, emoji: true },
      close: { type: "plain_text", text: input.modal.close, emoji: true },
      private_metadata: input.workflowContext && input.workflowContext.workflowId ? String(input.workflowContext.workflowId) : "",
      blocks: input.blocks,
    };
    const r = await slackApi("views.open", { trigger_id: input.triggerId, view });
    process.stdout.write(JSON.stringify({ success: Boolean(r.ok), error: r.error }));
    return;
  }

  throw new Error("Unknown operation: " + input.operation);
}

run().catch((err) => {
  process.stdout.write(JSON.stringify({ success: false, error: err.message }));
});
'
      `.trim(),
    ]);
  },
};

