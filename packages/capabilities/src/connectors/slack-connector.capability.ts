/**
 * packages/capabilities/src/connectors/slack-connector.capability.ts
 * Slack Connector Capability (OCS-001 Connector Pattern)
 *
 * Provides Slack API integration for messaging, channels, and reactions.
 */
import { z } from '@golden/schema-registry';
import type { Capability, CapabilityContext } from '@golden/core';

const operationSchema = z.enum([
  'sendMessage',
  'updateMessage',
  'deleteMessage',
  'addReaction',
  'removeReaction',
  'getChannelInfo',
  'listChannels',
  'uploadFile',
]).describe('Slack operation to perform');

const blockSchema = z.record(z.unknown()).describe('Slack Block Kit block');

const inputSchema = z
  .object({
    operation: operationSchema,
    channel: z.string().optional().describe('Channel ID or name (e.g., #general or C12345678)'),
    text: z.string().optional().describe('Message text'),
    blocks: z.array(blockSchema).optional().describe('Block Kit blocks'),
    ts: z.string().optional().describe('Message timestamp (for updates/reactions)'),
    name: z.string().optional().describe('Reaction emoji name (without colons)'),
    threadTs: z.string().optional().describe('Thread parent timestamp for replies'),
    unfurlLinks: z.boolean().optional().describe('Enable link unfurling'),
    unfurlMedia: z.boolean().optional().describe('Enable media unfurling'),
    file: z.string().optional().describe('File content (base64) for upload'),
    filename: z.string().optional().describe('Filename for upload'),
  })
  .describe('Slack Connector input');

const outputSchema = z
  .object({
    ok: z.boolean().describe('Whether the operation succeeded'),
    channel: z.string().optional().describe('Channel ID'),
    ts: z.string().optional().describe('Message timestamp'),
    message: z.record(z.unknown()).optional().describe('Message object'),
    channelInfo: z.record(z.unknown()).optional().describe('Channel info'),
    channels: z.array(z.record(z.unknown())).optional().describe('List of channels'),
    file: z.record(z.unknown()).optional().describe('Uploaded file info'),
    error: z.string().optional().describe('Error message if failed'),
  })
  .describe('Slack Connector output');

const configSchema = z
  .object({
    defaultChannel: z.string().optional().describe('Default channel for messages'),
    rateLimitRetry: z.boolean().optional().describe('Auto-retry on rate limit'),
  })
  .describe('Slack Connector configuration');

const secretsSchema = z
  .object({
    botToken: z.string().describe('Slack Bot User OAuth Token (xoxb-...)'),
  })
  .describe('Slack Connector secrets');

export type SlackConnectorInput = z.infer<typeof inputSchema>;
export type SlackConnectorOutput = z.infer<typeof outputSchema>;
export type SlackConnectorConfig = z.infer<typeof configSchema>;
export type SlackConnectorSecrets = z.infer<typeof secretsSchema>;

export const slackConnectorCapability: Capability<
  SlackConnectorInput,
  SlackConnectorOutput,
  SlackConnectorConfig,
  SlackConnectorSecrets
> = {
  metadata: {
    id: 'golden.connectors.slack',
    version: '1.0.0',
    name: 'slackConnector',
    description:
      'Slack API integration for sending messages, managing reactions, and channel operations. Supports Block Kit for rich messages.',
    tags: ['connector', 'slack', 'messaging'],
    maintainer: 'platform',
  },
  schemas: {
    input: inputSchema,
    output: outputSchema,
    config: configSchema,
    secrets: secretsSchema,
  },
  security: {
    requiredScopes: ['slack:write', 'slack:read'],
    dataClassification: 'INTERNAL',
    networkAccess: {
      allowOutbound: ['slack.com', 'api.slack.com', 'files.slack.com'],
    },
  },
  operations: {
    isIdempotent: false,
    retryPolicy: { maxAttempts: 3, initialIntervalSeconds: 1, backoffCoefficient: 2 },
    errorMap: (error: unknown) => {
      if (error instanceof Error) {
        if (error.message.includes('rate_limited')) return 'RETRYABLE';
        if (error.message.includes('channel_not_found')) return 'FATAL';
        if (error.message.includes('invalid_auth')) return 'FATAL';
      }
      return 'FATAL';
    },
    costFactor: 'LOW',
  },
  aiHints: {
    exampleInput: {
      operation: 'sendMessage',
      channel: '#general',
      text: 'Hello from Harmony! :wave:',
      blocks: [
        {
          type: 'section',
          text: { type: 'mrkdwn', text: '*Deployment Complete* :white_check_mark:' },
        },
      ],
    },
    exampleOutput: {
      ok: true,
      channel: 'C12345678',
      ts: '1234567890.123456',
      message: {
        text: 'Hello from Harmony! :wave:',
        ts: '1234567890.123456',
      },
    },
    usageNotes:
      'Use Block Kit for rich formatting. Provide channel ID (C...) for reliability over channel names. Thread replies require threadTs.',
  },
  factory: (
    dag,
    context: CapabilityContext<SlackConnectorConfig, SlackConnectorSecrets>,
    input: SlackConnectorInput
  ) => {
    // ISS-compliant types - includes withMountedSecret for secret mounting
    type DaggerSecret = unknown;
    type ContainerBuilder = {
      from(image: string): ContainerBuilder;
      withEnvVariable(key: string, value: string): ContainerBuilder;
      withMountedSecret(path: string, secret: DaggerSecret): ContainerBuilder;
      withExec(args: string[]): unknown;
    };
    type DaggerClient = {
      container(): ContainerBuilder;
      setSecret(name: string, value: string): DaggerSecret;
    };
    const d = dag as unknown as DaggerClient;

    const payload = {
      operation: input.operation,
      channel: input.channel ?? context.config.defaultChannel,
      text: input.text,
      blocks: input.blocks,
      ts: input.ts,
      name: input.name,
      threadTs: input.threadTs,
      unfurlLinks: input.unfurlLinks,
      unfurlMedia: input.unfurlMedia,
      file: input.file,
      filename: input.filename,
      rateLimitRetry: context.config.rateLimitRetry ?? true,
    };

    // Build container with mounted secrets (ISS-compliant)
    let container = d
      .container()
      .from('node:20-alpine')
      .withEnvVariable('INPUT_JSON', JSON.stringify(payload))
      .withEnvVariable('OPERATION', input.operation)
      .withEnvVariable('CHANNEL', input.channel ?? context.config.defaultChannel ?? '');

    // Mount bot token if provided and withMountedSecret is available (platform resolves to Dagger Secret)
    if (context.secretRefs.botToken && typeof (container as Record<string, unknown>).withMountedSecret === 'function') {
      container = container.withMountedSecret('/run/secrets/bot_token', context.secretRefs.botToken as unknown as DaggerSecret);
    }

    return container.withExec([
      'sh',
      '-c',
      `
npm install --no-save @slack/web-api 2>/dev/null && node -e '
const { WebClient } = require("@slack/web-api");
const fs = require("fs");
const input = JSON.parse(process.env.INPUT_JSON);

async function run() {
  // ISS-compliant: Read token from mounted path only
  const BOT_TOKEN_PATH = "/run/secrets/bot_token";
  let token = null;
  if (fs.existsSync(BOT_TOKEN_PATH)) {
    token = fs.readFileSync(BOT_TOKEN_PATH, "utf8").trim();
  }
  
  if (!token) {
    throw new Error("Slack bot token not mounted at " + BOT_TOKEN_PATH);
  }

  const client = new WebClient(token);
  let result;

  switch (input.operation) {
    case "sendMessage":
      result = await client.chat.postMessage({
        channel: input.channel,
        text: input.text,
        blocks: input.blocks,
        thread_ts: input.threadTs,
        unfurl_links: input.unfurlLinks,
        unfurl_media: input.unfurlMedia,
      });
      break;

    case "updateMessage":
      result = await client.chat.update({
        channel: input.channel,
        ts: input.ts,
        text: input.text,
        blocks: input.blocks,
      });
      break;

    case "deleteMessage":
      result = await client.chat.delete({
        channel: input.channel,
        ts: input.ts,
      });
      break;

    case "addReaction":
      result = await client.reactions.add({
        channel: input.channel,
        timestamp: input.ts,
        name: input.name,
      });
      break;

    case "removeReaction":
      result = await client.reactions.remove({
        channel: input.channel,
        timestamp: input.ts,
        name: input.name,
      });
      break;

    case "getChannelInfo":
      result = await client.conversations.info({
        channel: input.channel,
      });
      break;

    case "listChannels":
      result = await client.conversations.list({
        types: "public_channel,private_channel",
      });
      break;

    case "uploadFile":
      const fileBuffer = Buffer.from(input.file, "base64");
      result = await client.files.uploadV2({
        channel_id: input.channel,
        file: fileBuffer,
        filename: input.filename || "file",
      });
      break;

    default:
      throw new Error("Unknown operation: " + input.operation);
  }

  const output = {
    ok: result.ok,
    channel: result.channel?.id || result.channel,
    ts: result.ts || result.message?.ts,
    message: result.message,
    channelInfo: result.channel,
    channels: result.channels,
    file: result.file,
    error: result.error,
  };

  process.stdout.write(JSON.stringify(output));
}

run().catch(err => {
  process.stdout.write(JSON.stringify({
    ok: false,
    error: err.message,
  }));
});
'
        `.trim(),
    ]);
  },
};
