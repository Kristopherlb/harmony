/**
 * packages/capabilities/src/connectors/slack-connector.capability.test.ts
 * TCS-001 contract verification for Slack Connector capability.
 */
import { describe, it, expect } from 'vitest';
import { slackConnectorCapability } from './slack-connector.capability.js';

describe('slackConnectorCapability', () => {
    describe('TCS-001 contract verification', () => {
        it('validates aiHints examples against input schema', () => {
            expect(() =>
                slackConnectorCapability.schemas.input.parse(slackConnectorCapability.aiHints.exampleInput)
            ).not.toThrow();
        });

        it('validates aiHints examples against output schema', () => {
            expect(() =>
                slackConnectorCapability.schemas.output.parse(slackConnectorCapability.aiHints.exampleOutput)
            ).not.toThrow();
        });

        it('has required OCS metadata fields', () => {
            expect(slackConnectorCapability.metadata.id).toBe('golden.connectors.slack');
            expect(slackConnectorCapability.metadata.version).toMatch(/^\d+\.\d+\.\d+$/);
            expect(slackConnectorCapability.metadata.name).toBe('slackConnector');
            expect(slackConnectorCapability.metadata.description).toBeTruthy();
            expect(slackConnectorCapability.metadata.tags).toContain('connector');
        });

        it('declares network access for Slack API', () => {
            expect(slackConnectorCapability.security.networkAccess.allowOutbound).toContain('slack.com');
        });
    });

    describe('factory - send message', () => {
        it('builds a Dagger container for sending messages', () => {
            const calls: { env: Array<{ key: string; value: string }>; exec: string[][]; from: string[] } = {
                env: [],
                exec: [],
                from: [],
            };
            const fakeDag = {
                container() {
                    const builder = {
                        from(image: string) {
                            calls.from.push(image);
                            return builder;
                        },
                        withEnvVariable(key: string, value: string) {
                            calls.env.push({ key, value });
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

            slackConnectorCapability.factory(
                fakeDag,
                {
                    ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
                    config: {},
                    secretRefs: { botToken: '/secrets/slack-token' },
                },
                {
                    operation: 'sendMessage',
                    channel: '#general',
                    text: 'Hello from Harmony!',
                }
            );

            expect(calls.from[0]).toContain('node:');
            expect(calls.env.some((e) => e.key === 'OPERATION' && e.value === 'sendMessage')).toBe(true);
            expect(calls.env.some((e) => e.key === 'CHANNEL' && e.value === '#general')).toBe(true);
        });
    });

    describe('factory - send blocks', () => {
        it('supports Block Kit messages', () => {
            const calls: { env: Array<{ key: string; value: string }> } = { env: [] };
            const fakeDag = {
                container: () => ({
                    from: () => ({
                        withEnvVariable: (key: string, value: string) => {
                            calls.env.push({ key, value });
                            return fakeDag.container().from();
                        },
                        withExec: () => fakeDag.container().from(),
                    }),
                }),
            };

            slackConnectorCapability.factory(
                fakeDag,
                {
                    ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
                    config: {},
                    secretRefs: { botToken: '/secrets/slack-token' },
                },
                {
                    operation: 'sendMessage',
                    channel: 'C12345678',
                    blocks: [
                        { type: 'section', text: { type: 'mrkdwn', text: '*Bold* text' } },
                    ],
                }
            );

            const inputJson = calls.env.find((e) => e.key === 'INPUT_JSON');
            expect(inputJson).toBeDefined();
            const parsed = JSON.parse(inputJson!.value);
            expect(parsed.blocks).toHaveLength(1);
        });
    });

    describe('schema validation', () => {
        it('accepts all operations', () => {
            const operations = [
                { operation: 'sendMessage', channel: '#test', text: 'Hello' },
                { operation: 'updateMessage', channel: '#test', ts: '123.456', text: 'Updated' },
                { operation: 'deleteMessage', channel: '#test', ts: '123.456' },
                { operation: 'addReaction', channel: '#test', ts: '123.456', name: 'thumbsup' },
                { operation: 'getChannelInfo', channel: '#test' },
            ];

            for (const input of operations) {
                expect(() =>
                    slackConnectorCapability.schemas.input.parse(input)
                ).not.toThrow();
            }
        });

        it('accepts sendMessage without channel (uses default)', () => {
            // channel is optional - will use default if not provided
            const result = slackConnectorCapability.schemas.input.safeParse({
                operation: 'sendMessage',
                text: 'Missing channel',
            });
            expect(result.success).toBe(true);
        });
    });
});
