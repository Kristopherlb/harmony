import type { Tree } from '@nx/devkit';

function assertKebabCase(value: string): void {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    throw new Error(`Invalid name (expected kebab-case): ${value}`);
  }
}

function toCamelCase(kebab: string): string {
  const [first, ...rest] = kebab.split('-');
  return [first, ...rest.map((p) => p.slice(0, 1).toUpperCase() + p.slice(1))].join('');
}

function toUpperSnakeCase(kebab: string): string {
  return kebab.replace(/[-.]/g, '_').toUpperCase();
}

function toTitleCase(kebab: string): string {
  return kebab
    .split('-')
    .filter((p) => p.trim().length > 0)
    .map((p) => p.slice(0, 1).toUpperCase() + p.slice(1))
    .join(' ');
}

function upsertCoreWorkflowExport(tree: Tree, exportLine: string): void {
  const workflowPath = 'packages/core/src/wcs/workflow.ts';
  if (!tree.exists(workflowPath)) return;

  const current = tree.read(workflowPath, 'utf-8') ?? '';
  if (current.includes(exportLine)) return;

  const next = current.trimEnd() + '\n' + exportLine + '\n';
  tree.write(workflowPath, next);
}

export interface HitlGateGeneratorSchema {
  name: string;
  notificationChannel?: 'slack' | 'console' | 'both';
  timeout?: string;
}

export default async function hitlGateGenerator(tree: Tree, options: HitlGateGeneratorSchema) {
  assertKebabCase(options.name);
  const notificationChannel = options.notificationChannel ?? 'both';
  const timeoutDefault = options.timeout ?? '1h';

  const gateName = options.name;
  const base = toCamelCase(gateName);
  const title = toTitleCase(gateName);
  const upperSnake = toUpperSnakeCase(gateName);

  const signalPath = `packages/core/src/wcs/${gateName}-signal.ts`;
  const signalTestPath = `packages/core/src/wcs/${gateName}-signal.test.ts`;
  const activitiesPath = `packages/blueprints/src/activities/${gateName}-activities.ts`;
  const activitiesTestPath = `packages/blueprints/src/activities/${gateName}-activities.test.ts`;

  const signalConst = `${base}Signal`;
  const queryConst = `${base}StateQuery`;
  const actionIdsConst = `${upperSnake}_ACTION_IDS`;

  if (!tree.exists(signalPath)) {
    const file = `/**
 * ${signalPath}
 * Generated HITL gate signal/query contracts (TSQ-001 / WCS-001).
 *
 * Gate: ${gateName}
 * Notifications: ${notificationChannel}
 * Default timeout: ${timeoutDefault}
 */
import { defineSignal, defineQuery } from '@temporalio/workflow';

export type ${base[0].toUpperCase()}${base.slice(1)}Decision = 'approved' | 'rejected';

export interface ${base[0].toUpperCase()}${base.slice(1)}SignalPayload {
  decision: ${base[0].toUpperCase()}${base.slice(1)}Decision;
  approverId: string;
  approverName?: string;
  approverRoles: string[];
  reason?: string;
  timestamp: string;
  source: 'console' | 'slack' | 'api';
}

export type ${base[0].toUpperCase()}${base.slice(1)}Status = 'pending' | 'approved' | 'rejected' | 'timeout' | 'cancelled';

export interface ${base[0].toUpperCase()}${base.slice(1)}State {
  status: ${base[0].toUpperCase()}${base.slice(1)}Status;
  requestedAt: string;
  requestReason: string;
  requiredRoles: string[];
  timeout: string;
  workflowId: string;
  slackMessageTs?: string;
  slackChannel?: string;
  decision?: ${base[0].toUpperCase()}${base.slice(1)}SignalPayload;
}

/**
 * Signal name is a contract. Keep stable once shipped.
 * Signal name: ${gateName}
 */
export const ${signalConst} = defineSignal<[${base[0].toUpperCase()}${base.slice(1)}SignalPayload]>(${JSON.stringify(
      gateName
    )});

/**
 * Query name is a contract. Keep stable once shipped.
 * Query name: ${gateName}State
 */
export const ${queryConst} = defineQuery<${base[0].toUpperCase()}${base.slice(1)}State>(${JSON.stringify(
      `${gateName}State`
    )});

export class ${base[0].toUpperCase()}${base.slice(1)}TimeoutError extends Error {
  constructor(
    public readonly workflowId: string,
    public readonly timeout: string,
    public readonly requestReason: string
  ) {
    super(\`${title} timed out after \${timeout}: \${requestReason}\`);
    this.name = '${base[0].toUpperCase()}${base.slice(1)}TimeoutError';
  }
}

export class ${base[0].toUpperCase()}${base.slice(1)}RejectedError extends Error {
  constructor(
    public readonly decision: ${base[0].toUpperCase()}${base.slice(1)}SignalPayload
  ) {
    super(
      \`${title} rejected by \${decision.approverId}: \${decision.reason ?? 'No reason provided'}\`
    );
    this.name = '${base[0].toUpperCase()}${base.slice(1)}RejectedError';
  }
}

export const ${actionIdsConst} = {
  APPROVE: ${JSON.stringify(`${gateName}_approve`)},
  REJECT: ${JSON.stringify(`${gateName}_reject`)},
} as const;

export function create${base[0].toUpperCase()}${base.slice(1)}Blocks(params: {
  workflowId: string;
  reason: string;
  requiredRoles: string[];
  timeout: string;
  requestedBy: string;
}): unknown[] {
  const blocks: unknown[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: '🔐 ${title} Required', emoji: true },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: \`*Reason:* \${params.reason}\` },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: \`*Requested by:*\\n\${params.requestedBy}\` },
        { type: 'mrkdwn', text: \`*Timeout:*\\n\${params.timeout}\` },
      ],
    },
  ];

  if (params.requiredRoles.length > 0) {
    blocks.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: \`Required roles: \${params.requiredRoles.join(', ')}\` }],
    });
  }

  blocks.push({
    type: 'actions',
    block_id: ${JSON.stringify(`${gateName}_`)} + params.workflowId,
    elements: [
      {
        type: 'button',
        text: { type: 'plain_text', text: '✅ Approve', emoji: true },
        style: 'primary',
        action_id: ${actionIdsConst}.APPROVE,
        value: params.workflowId,
      },
      {
        type: 'button',
        text: { type: 'plain_text', text: '❌ Reject', emoji: true },
        style: 'danger',
        action_id: ${actionIdsConst}.REJECT,
        value: params.workflowId,
      },
    ],
  });

  return blocks;
}

export function create${base[0].toUpperCase()}${base.slice(1)}ResultBlocks(params: {
  originalReason: string;
  decision: ${base[0].toUpperCase()}${base.slice(1)}SignalPayload;
  durationMs: number;
}): unknown[] {
  const emoji = params.decision.decision === 'approved' ? '✅' : '❌';
  const status = params.decision.decision === 'approved' ? 'Approved' : 'Rejected';
  const durationStr = params.durationMs > 60000
    ? \`\${Math.round(params.durationMs / 60000)}m\`
    : \`\${Math.round(params.durationMs / 1000)}s\`;

  return [
    {
      type: 'header',
      text: { type: 'plain_text', text: \`\${emoji} ${title} \${status}\`, emoji: true },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: \`*Original request:* \${params.originalReason}\` },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: \`*\${status} by:*\\n\${params.decision.approverName ?? params.decision.approverId}\`,
        },
        { type: 'mrkdwn', text: \`*Response time:*\\n\${durationStr}\` },
      ],
    },
    ...(params.decision.reason
      ? [
          {
            type: 'section',
            text: { type: 'mrkdwn', text: \`*Reason:* \${params.decision.reason}\` },
          },
        ]
      : []),
    {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: \`Source: \${params.decision.source} | \${params.decision.timestamp}\` }],
    },
  ];
}
`;
    tree.write(signalPath, file);
  }

  if (!tree.exists(signalTestPath)) {
    const testFile = `/**
 * ${signalTestPath}
 * Unit tests for generated HITL gate helpers (TCS-001).
 */
import { describe, it, expect } from 'vitest';
import {
  ${actionIdsConst},
  create${base[0].toUpperCase()}${base.slice(1)}Blocks,
  create${base[0].toUpperCase()}${base.slice(1)}ResultBlocks,
} from './${gateName}-signal';

describe('${gateName}-signal', () => {
  it('defines stable action IDs', () => {
    expect(${actionIdsConst}.APPROVE).toBe(${JSON.stringify(`${gateName}_approve`)});
    expect(${actionIdsConst}.REJECT).toBe(${JSON.stringify(`${gateName}_reject`)});
  });

  it('builds approval blocks with actions', () => {
    const blocks = create${base[0].toUpperCase()}${base.slice(1)}Blocks({
      workflowId: 'wf-1',
      reason: 'Test',
      requiredRoles: ['ops'],
      timeout: '30m',
      requestedBy: 'user@example.com',
    });

    const actions = (blocks as any[]).find((b) => b.type === 'actions');
    expect(actions).toBeDefined();
    expect(actions.elements).toHaveLength(2);
  });

  it('builds result blocks', () => {
    const blocks = create${base[0].toUpperCase()}${base.slice(1)}ResultBlocks({
      originalReason: 'Test',
      decision: {
        decision: 'approved',
        approverId: 'u1',
        approverRoles: [],
        timestamp: '2026-02-01T00:00:00Z',
        source: 'console',
      },
      durationMs: 10_000,
    });
    expect((blocks as any[]).find((b) => b.type === 'header')).toBeDefined();
  });
});
`;
    tree.write(signalTestPath, testFile);
  }

  if (!tree.exists(activitiesPath)) {
    const activitiesFile = `/**
 * ${activitiesPath}
 * Generated Slack notification activities for HITL gate (${gateName}).
 *
 * These activities are meant to be registered with a Temporal worker.
 * They are NOT automatically wired into BaseBlueprint.waitForApproval().
 */
import {
  create${base[0].toUpperCase()}${base.slice(1)}Blocks,
  create${base[0].toUpperCase()}${base.slice(1)}ResultBlocks,
  type ${base[0].toUpperCase()}${base.slice(1)}SignalPayload,
} from '@golden/core/workflow';

export interface ${base[0].toUpperCase()}${base.slice(1)}NotificationActivities {
  send${base[0].toUpperCase()}${base.slice(1)}RequestToSlack(params: {
    channel: string;
    workflowId: string;
    reason: string;
    requiredRoles: string[];
    timeout: string;
    requestedBy: string;
  }): Promise<{ messageTs: string }>;

  update${base[0].toUpperCase()}${base.slice(1)}Message(params: {
    channel: string;
    messageTs: string;
    originalReason: string;
    decision: ${base[0].toUpperCase()}${base.slice(1)}SignalPayload;
    durationMs: number;
  }): Promise<void>;
}

export function create${base[0].toUpperCase()}${base.slice(1)}Activities(config?: {
  slackBotToken?: string;
  slackBotTokenPath?: string;
}): ${base[0].toUpperCase()}${base.slice(1)}NotificationActivities {
  const getSlackToken = (): string => {
    if (config?.slackBotToken) return config.slackBotToken;
    if (config?.slackBotTokenPath) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require('fs');
      return fs.readFileSync(config.slackBotTokenPath, 'utf8').trim();
    }
    const envToken = process.env.SLACK_BOT_TOKEN;
    if (envToken) return envToken;
    throw new Error('Slack bot token not configured. Set SLACK_BOT_TOKEN or provide via config.');
  };

  return {
    async send${base[0].toUpperCase()}${base.slice(1)}RequestToSlack(params): Promise<{ messageTs: string }> {
      const token = getSlackToken();
      const blocks = create${base[0].toUpperCase()}${base.slice(1)}Blocks({
        workflowId: params.workflowId,
        reason: params.reason,
        requiredRoles: params.requiredRoles,
        timeout: params.timeout,
        requestedBy: params.requestedBy,
      });

      const response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: { Authorization: \`Bearer \${token}\`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: params.channel,
          blocks,
          text: \`🔐 ${title} Required: \${params.reason}\`,
        }),
      });

      const result = (await response.json()) as { ok: boolean; ts?: string; error?: string };
      if (!result.ok) throw new Error(\`Failed to send Slack message: \${result.error}\`);
      return { messageTs: result.ts ?? '' };
    },

    async update${base[0].toUpperCase()}${base.slice(1)}Message(params): Promise<void> {
      const token = getSlackToken();
      const blocks = create${base[0].toUpperCase()}${base.slice(1)}ResultBlocks({
        originalReason: params.originalReason,
        decision: params.decision,
        durationMs: params.durationMs,
      });

      const response = await fetch('https://slack.com/api/chat.update', {
        method: 'POST',
        headers: { Authorization: \`Bearer \${token}\`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: params.channel,
          ts: params.messageTs,
          blocks,
          text: \`\${params.decision.decision === 'approved' ? '✅' : '❌'} ${title}: \${params.originalReason}\`,
        }),
      });

      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) console.warn(\`Failed to update Slack message: \${result.error}\`);
    },
  };
}

export function createMock${base[0].toUpperCase()}${base.slice(1)}Activities(): ${base[0].toUpperCase()}${base.slice(1)}NotificationActivities & {
  calls: {
    send: Parameters<${base[0].toUpperCase()}${base.slice(1)}NotificationActivities['send${base[0].toUpperCase()}${base.slice(1)}RequestToSlack']>[];
    update: Parameters<${base[0].toUpperCase()}${base.slice(1)}NotificationActivities['update${base[0].toUpperCase()}${base.slice(1)}Message']>[];
  };
} {
  const calls = {
    send: [] as Parameters<${base[0].toUpperCase()}${base.slice(1)}NotificationActivities['send${base[0].toUpperCase()}${base.slice(1)}RequestToSlack']>[],
    update: [] as Parameters<${base[0].toUpperCase()}${base.slice(1)}NotificationActivities['update${base[0].toUpperCase()}${base.slice(1)}Message']>[],
  };

  return {
    calls,
    async send${base[0].toUpperCase()}${base.slice(1)}RequestToSlack(params) {
      calls.send.push([params]);
      return { messageTs: 'mock-ts-1' };
    },
    async update${base[0].toUpperCase()}${base.slice(1)}Message(params) {
      calls.update.push([params]);
    },
  };
}
`;
    tree.write(activitiesPath, activitiesFile);
  }

  if (!tree.exists(activitiesTestPath)) {
    const activitiesTest = `/**
 * ${activitiesTestPath}
 * Unit tests for generated gate activities (TCS-001).
 */
import { describe, it, expect } from 'vitest';
import { createMock${base[0].toUpperCase()}${base.slice(1)}Activities } from './${gateName}-activities';

describe('${gateName}-activities', () => {
  it('records calls in mock implementation', async () => {
    const a = createMock${base[0].toUpperCase()}${base.slice(1)}Activities();
    await a.send${base[0].toUpperCase()}${base.slice(1)}RequestToSlack({
      channel: '#c',
      workflowId: 'wf-1',
      reason: 'Test',
      requiredRoles: [],
      timeout: '1h',
      requestedBy: 'user@example.com',
    });
    expect(a.calls.send).toHaveLength(1);
  });
});
`;
    tree.write(activitiesTestPath, activitiesTest);
  }

  const exportLine = `export { ${signalConst}, ${queryConst} } from './${gateName}-signal.js';`;
  upsertCoreWorkflowExport(tree, exportLine);

  return () => {};
}

