/**
 * packages/capabilities/src/connectors/pagerduty.capability.test.ts
 * TCS-001 contract verification for PagerDuty capability.
 */
import { describe, it, expect } from 'vitest';
import { pagerdutyCapability } from './pagerduty.capability.js';

describe('pagerdutyCapability', () => {
    describe('TCS-001 contract verification', () => {
        it('validates aiHints examples against input schema', () => {
            expect(() =>
                pagerdutyCapability.schemas.input.parse(pagerdutyCapability.aiHints.exampleInput)
            ).not.toThrow();
        });

        it('validates aiHints examples against output schema', () => {
            expect(() =>
                pagerdutyCapability.schemas.output.parse(pagerdutyCapability.aiHints.exampleOutput)
            ).not.toThrow();
        });

        it('has required OCS metadata fields', () => {
            expect(pagerdutyCapability.metadata.id).toBe('golden.connectors.pagerduty');
            expect(pagerdutyCapability.metadata.version).toMatch(/^\d+\.\d+\.\d+$/);
            expect(pagerdutyCapability.metadata.name).toBe('pagerduty');
            expect(pagerdutyCapability.metadata.tags).toContain('pagerduty');
            expect(pagerdutyCapability.metadata.tags).toContain('incidents');
        });

        it('declares correct network access', () => {
            expect(pagerdutyCapability.security.networkAccess.allowOutbound).toContain('api.pagerduty.com');
            expect(pagerdutyCapability.security.networkAccess.allowOutbound).toContain('events.pagerduty.com');
        });
    });

    describe('schema validation', () => {
        it('accepts all operations', () => {
            const operations = [
                'create-incident', 'resolve-incident', 'acknowledge', 'add-note',
                'get-incident', 'list-incidents', 'get-oncall', 'trigger-event',
            ];
            for (const operation of operations) {
                expect(() =>
                    pagerdutyCapability.schemas.input.parse({ operation })
                ).not.toThrow();
            }
        });

        it('accepts urgency levels', () => {
            for (const urgency of ['high', 'low']) {
                expect(() =>
                    pagerdutyCapability.schemas.input.parse({ operation: 'create-incident', urgency })
                ).not.toThrow();
            }
        });

        it('accepts severity levels for events', () => {
            for (const severity of ['critical', 'error', 'warning', 'info']) {
                expect(() =>
                    pagerdutyCapability.schemas.input.parse({ operation: 'trigger-event', severity })
                ).not.toThrow();
            }
        });

        it('accepts incident with full details', () => {
            const result = pagerdutyCapability.schemas.output.safeParse({
                success: true,
                operation: 'get-incident',
                incident: {
                    id: 'Q123',
                    title: 'Test incident',
                    status: 'triggered',
                    urgency: 'high',
                    service: { id: 'P123', name: 'Test Service' },
                    createdAt: '2024-01-15T10:00:00Z',
                    htmlUrl: 'https://test.pagerduty.com/incidents/Q123',
                },
                message: 'Retrieved',
            });
            expect(result.success).toBe(true);
        });
    });

    describe('factory function', () => {
        it('builds a Dagger container for incident creation', () => {
            const calls: { env: Array<{ key: string; value: string }>; from: string[] } = {
                env: [],
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
                        withMountedSecret() {
                            return builder;
                        },
                        withExec() {
                            return builder;
                        },
                    };
                    return builder;
                },
            };

            pagerdutyCapability.factory(
                fakeDag,
                {
                    ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
                    config: { defaultServiceId: 'P123' },
                    secretRefs: {},
                },
                {
                    operation: 'create-incident',
                    title: 'Test incident',
                }
            );

            expect(calls.from[0]).toContain('curl');
            expect(calls.env.some((e) => e.key === 'OPERATION' && e.value === 'create-incident')).toBe(true);
        });
    });
});
