/**
 * packages/capabilities/src/flags/auto-feature-flag.capability.test.ts
 * TCS-001 contract verification for AutoFeatureFlag capability.
 */
import { describe, it, expect } from 'vitest';
import { autoFeatureFlagCapability } from './auto-feature-flag.capability.js';

describe('autoFeatureFlagCapability', () => {
    describe('TCS-001 contract verification', () => {
        it('validates aiHints examples against input schema', () => {
            expect(() =>
                autoFeatureFlagCapability.schemas.input.parse(autoFeatureFlagCapability.aiHints.exampleInput)
            ).not.toThrow();
        });

        it('validates aiHints examples against output schema', () => {
            expect(() =>
                autoFeatureFlagCapability.schemas.output.parse(autoFeatureFlagCapability.aiHints.exampleOutput)
            ).not.toThrow();
        });

        it('has required OCS metadata fields', () => {
            expect(autoFeatureFlagCapability.metadata.id).toBe('golden.flags.auto-feature-flag');
            expect(autoFeatureFlagCapability.metadata.version).toMatch(/^\d+\.\d+\.\d+$/);
            expect(autoFeatureFlagCapability.metadata.name).toBe('autoFeatureFlag');
            expect(autoFeatureFlagCapability.metadata.description).toBeTruthy();
            expect(autoFeatureFlagCapability.metadata.tags).toContain('flags');
            expect(autoFeatureFlagCapability.metadata.tags).toContain('rollout');
        });

        it('declares no network access (runs locally)', () => {
            expect(autoFeatureFlagCapability.security.networkAccess.allowOutbound).toEqual([]);
        });

        it('requires flags:write scope', () => {
            expect(autoFeatureFlagCapability.security.requiredScopes).toContain('flags:write');
        });
    });

    describe('factory - generateReleaseFlags', () => {
        it('builds a Dagger container for release flag generation', () => {
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

            autoFeatureFlagCapability.factory(
                fakeDag,
                {
                    ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
                    config: {},
                    secretRefs: {},
                },
                {
                    operation: 'generateReleaseFlags',
                    releaseVersion: '2.0.0',
                }
            );

            expect(calls.from[0]).toContain('node');
            expect(calls.env.some((e) => e.key === 'OPERATION' && e.value === 'generateReleaseFlags')).toBe(true);
        });
    });

    describe('factory - setFlagState', () => {
        it('builds a Dagger container for flag state update', () => {
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

            autoFeatureFlagCapability.factory(
                fakeDag,
                {
                    ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
                    config: {},
                    secretRefs: {},
                },
                {
                    operation: 'setFlagState',
                    targetId: 'release-2.0.0-enabled',
                    enabled: true,
                    rolloutPercentage: 50,
                }
            );

            expect(calls.env.some((e) => e.key === 'OPERATION' && e.value === 'setFlagState')).toBe(true);
        });
    });

    describe('schema validation', () => {
        it('accepts all operations', () => {
            const operations = [
                'generateReleaseFlags',
                'generateCapabilityFlags',
                'generateBlueprintFlags',
                'setFlagState',
                'rollbackRelease',
                'getFlagStatus',
            ];

            for (const operation of operations) {
                expect(() =>
                    autoFeatureFlagCapability.schemas.input.parse({ operation })
                ).not.toThrow();
            }
        });

        it('accepts rollout percentage between 0 and 100', () => {
            expect(() =>
                autoFeatureFlagCapability.schemas.input.parse({
                    operation: 'setFlagState',
                    targetId: 'test-flag',
                    rolloutPercentage: 50,
                })
            ).not.toThrow();

            expect(() =>
                autoFeatureFlagCapability.schemas.input.parse({
                    operation: 'setFlagState',
                    targetId: 'test-flag',
                    rolloutPercentage: 101,
                })
            ).toThrow();
        });

        it('accepts targeting rules', () => {
            expect(() =>
                autoFeatureFlagCapability.schemas.input.parse({
                    operation: 'setFlagState',
                    targetId: 'test-flag',
                    targetingRules: [
                        { attribute: 'userId', operator: 'in', value: ['user1', 'user2'] },
                        { attribute: 'environment', operator: 'equals', value: 'production' },
                    ],
                })
            ).not.toThrow();
        });

        it('accepts valid output with generated flags', () => {
            const result = autoFeatureFlagCapability.schemas.output.safeParse({
                operation: 'generateCapabilityFlags',
                flagsGenerated: [
                    {
                        flagKey: 'cap-golden.security.trivy-enabled',
                        defaultValue: true,
                        variants: { on: true, off: false },
                        state: 'ENABLED',
                    },
                ],
                flagdConfigPath: 'deploy/flagd/flags.json',
                syncStatus: 'PENDING',
                message: 'Generated 1 capability flags',
            });
            expect(result.success).toBe(true);
        });
    });
});
