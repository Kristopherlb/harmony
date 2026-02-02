/**
 * packages/capabilities/src/integrations/slack-interactive.capability.test.ts
 * TCS-001 contract verification for Slack interactive capability.
 */
import { describe, it, expect } from 'vitest';
import { slackInteractiveCapability } from './slack-interactive.capability.js';

describe('slackInteractiveCapability', () => {
  it('validates aiHints examples against schemas', () => {
    expect(() =>
      slackInteractiveCapability.schemas.input.parse(slackInteractiveCapability.aiHints.exampleInput)
    ).not.toThrow();
    expect(() =>
      slackInteractiveCapability.schemas.output.parse(slackInteractiveCapability.aiHints.exampleOutput)
    ).not.toThrow();
  });

  it('does not install npm deps at runtime (uses fetch-based Slack Web API calls)', () => {
    const calls: { exec: string[][] } = { exec: [] };
    const fakeDag = {
      container() {
        const builder: any = {
          from() {
            return builder;
          },
          withEnvVariable() {
            return builder;
          },
          withMountedSecret() {
            return builder;
          },
          withExec(args: string[]) {
            calls.exec.push(args);
            return builder;
          },
        };
        return builder;
      },
    };

    slackInteractiveCapability.factory(
      fakeDag as any,
      {
        ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
        config: {},
        secretRefs: { botToken: '/secrets/slack-token' },
      } as any,
      {
        operation: 'send-approval-request',
        channel: '#general',
        text: 't',
        blocks: [],
      } as any
    );

    const script = calls.exec.find((a) => a[0] === 'sh' && a[1] === '-c')?.[2] ?? '';
    expect(script).not.toContain('npm install');
    expect(script).not.toContain('@slack/web-api');
    expect(script).toContain('https://slack.com/api/');
  });
});

