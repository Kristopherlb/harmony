/**
 * packages/capabilities/src/flags/openfeature-provider.capability.test.ts
 * TCS-001 contract verification for OpenFeature Provider capability.
 */
import { describe, it, expect } from 'vitest';
import { openFeatureProviderCapability } from './openfeature-provider.capability.js';

describe('openFeatureProviderCapability', () => {
    describe('TCS-001 contract verification', () => {
        it('validates aiHints examples against input schema', () => {
            expect(() =>
                openFeatureProviderCapability.schemas.input.parse(openFeatureProviderCapability.aiHints.exampleInput)
            ).not.toThrow();
        });

        it('validates aiHints examples against output schema', () => {
            expect(() =>
                openFeatureProviderCapability.schemas.output.parse(openFeatureProviderCapability.aiHints.exampleOutput)
            ).not.toThrow();
        });

        it('has required OCS metadata fields', () => {
            expect(openFeatureProviderCapability.metadata.id).toBe('golden.flags.openfeature-provider');
            expect(openFeatureProviderCapability.metadata.version).toMatch(/^\d+\.\d+\.\d+$/);
            expect(openFeatureProviderCapability.metadata.name).toBe('openFeatureProvider');
            expect(openFeatureProviderCapability.metadata.description).toBeTruthy();
            expect(openFeatureProviderCapability.metadata.tags).toContain('connector');
        });
    });

    describe('factory - boolean flag evaluation', () => {
        it('builds a Dagger container for boolean flag', () => {
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

            openFeatureProviderCapability.factory(
                fakeDag,
                {
                    ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
                    config: { provider: 'flagd', providerUrl: 'http://flagd:8013' },
                    secretRefs: {},
                },
                {
                    operation: 'evaluateBoolean',
                    flagKey: 'dark-mode-enabled',
                    defaultValue: false,
                }
            );

            expect(calls.from[0]).toContain('node:');
            expect(calls.env.some((e) => e.key === 'OPERATION' && e.value === 'evaluateBoolean')).toBe(true);
            expect(calls.env.some((e) => e.key === 'FLAG_KEY' && e.value === 'dark-mode-enabled')).toBe(true);
        });
    });

    describe('factory - string flag with context', () => {
        it('passes evaluation context to the container', () => {
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

            openFeatureProviderCapability.factory(
                fakeDag,
                {
                    ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
                    config: { provider: 'flagd', providerUrl: 'http://flagd:8013' },
                    secretRefs: {},
                },
                {
                    operation: 'evaluateString',
                    flagKey: 'button-color',
                    defaultValue: 'blue',
                    evaluationContext: {
                        targetingKey: 'user-123',
                        userId: 'user-123',
                        tier: 'premium',
                    },
                }
            );

            const inputJson = calls.env.find((e) => e.key === 'INPUT_JSON');
            expect(inputJson).toBeDefined();
            const parsed = JSON.parse(inputJson!.value);
            expect(parsed.evaluationContext.targetingKey).toBe('user-123');
        });
    });

    describe('schema validation', () => {
        it('accepts all evaluation operations', () => {
            const operations = ['evaluateBoolean', 'evaluateString', 'evaluateNumber', 'evaluateObject'];

            for (const operation of operations) {
                expect(() =>
                    openFeatureProviderCapability.schemas.input.parse({
                        operation,
                        flagKey: 'test-flag',
                        defaultValue: operation === 'evaluateBoolean' ? false :
                            operation === 'evaluateNumber' ? 0 :
                                operation === 'evaluateObject' ? {} : 'default',
                    })
                ).not.toThrow();
            }
        });

        it('requires flagKey', () => {
            expect(() =>
                openFeatureProviderCapability.schemas.input.parse({
                    operation: 'evaluateBoolean',
                    defaultValue: false,
                })
            ).toThrow();
        });
    });
});
