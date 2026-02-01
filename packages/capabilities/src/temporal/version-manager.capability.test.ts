/**
 * packages/capabilities/src/temporal/version-manager.capability.test.ts
 * TCS-001 contract verification for Temporal Version Manager capability.
 */
import { describe, it, expect } from 'vitest';
import { temporalVersionManagerCapability } from './version-manager.capability.js';

describe('temporalVersionManagerCapability', () => {
    describe('TCS-001 contract verification', () => {
        it('validates aiHints examples against input schema', () => {
            expect(() =>
                temporalVersionManagerCapability.schemas.input.parse(
                    temporalVersionManagerCapability.aiHints.exampleInput
                )
            ).not.toThrow();
        });

        it('validates aiHints examples against output schema', () => {
            expect(() =>
                temporalVersionManagerCapability.schemas.output.parse(
                    temporalVersionManagerCapability.aiHints.exampleOutput
                )
            ).not.toThrow();
        });

        it('has required OCS metadata fields', () => {
            expect(temporalVersionManagerCapability.metadata.id).toBe('golden.temporal.version-manager');
            expect(temporalVersionManagerCapability.metadata.version).toMatch(/^\d+\.\d+\.\d+$/);
            expect(temporalVersionManagerCapability.metadata.name).toBe('temporalVersionManager');
            expect(temporalVersionManagerCapability.metadata.description).toBeTruthy();
            expect(temporalVersionManagerCapability.metadata.tags).toContain('temporal');
            expect(temporalVersionManagerCapability.metadata.tags).toContain('deployment');
        });

        it('declares correct network access for Temporal', () => {
            expect(temporalVersionManagerCapability.security.networkAccess.allowOutbound).toContain('temporal:7233');
            expect(temporalVersionManagerCapability.security.networkAccess.allowOutbound).toContain('*.tmprl.cloud');
        });

        it('requires temporal:admin scope', () => {
            expect(temporalVersionManagerCapability.security.requiredScopes).toContain('temporal:admin');
        });
    });

    describe('factory - registerBuildAsDefault', () => {
        it('builds a Dagger container for Build ID registration', () => {
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

            temporalVersionManagerCapability.factory(
                fakeDag,
                {
                    ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
                    config: {},
                    secretRefs: {},
                },
                {
                    operation: 'registerBuildAsDefault',
                    buildId: 'v2.0.0',
                    taskQueue: 'golden-tools',
                }
            );

            expect(calls.from[0]).toContain('node');
            expect(calls.env.some((e) => e.key === 'OPERATION' && e.value === 'registerBuildAsDefault')).toBe(true);
            expect(calls.env.some((e) => e.key === 'BUILD_ID' && e.value === 'v2.0.0')).toBe(true);
            expect(calls.env.some((e) => e.key === 'TASK_QUEUE' && e.value === 'golden-tools')).toBe(true);
        });
    });

    describe('factory - waitForDrain', () => {
        it('builds a Dagger container for drain wait', () => {
            const calls: { env: Array<{ key: string; value: string }> } = { env: [] };
            const fakeDag = {
                container: () => ({
                    from: () => ({
                        withEnvVariable: (key: string, value: string) => {
                            calls.env.push({ key, value });
                            return fakeDag.container().from();
                        },
                        withMountedSecret: () => fakeDag.container().from(),
                        withExec: () => fakeDag.container().from(),
                    }),
                }),
            };

            temporalVersionManagerCapability.factory(
                fakeDag,
                {
                    ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
                    config: { defaultTimeoutSeconds: 300 },
                    secretRefs: {},
                },
                {
                    operation: 'waitForDrain',
                    buildId: 'v1.9.0',
                    taskQueue: 'golden-tools',
                    timeoutSeconds: 600,
                }
            );

            expect(calls.env.some((e) => e.key === 'OPERATION' && e.value === 'waitForDrain')).toBe(true);
            expect(calls.env.some((e) => e.key === 'BUILD_ID' && e.value === 'v1.9.0')).toBe(true);
        });
    });

    describe('schema validation', () => {
        it('accepts all operations', () => {
            const operations = ['registerBuildAsDefault', 'getActiveExecutions', 'waitForDrain', 'listBuildIds'];

            for (const operation of operations) {
                expect(() =>
                    temporalVersionManagerCapability.schemas.input.parse({
                        operation,
                        buildId: 'v1.0.0',
                    })
                ).not.toThrow();
            }
        });

        it('requires buildId', () => {
            expect(() =>
                temporalVersionManagerCapability.schemas.input.parse({
                    operation: 'registerBuildAsDefault',
                })
            ).toThrow();
        });

        it('accepts valid output with activeExecutions', () => {
            const result = temporalVersionManagerCapability.schemas.output.safeParse({
                success: true,
                buildId: 'v2.0.0',
                operation: 'getActiveExecutions',
                activeExecutions: 5,
                message: 'Found 5 active executions',
            });
            expect(result.success).toBe(true);
        });

        it('accepts valid output with buildIds list', () => {
            const result = temporalVersionManagerCapability.schemas.output.safeParse({
                success: true,
                buildId: 'v2.0.0',
                operation: 'listBuildIds',
                buildIds: [
                    { buildId: 'v1.0.0', isDefault: false, activeExecutions: 0 },
                    { buildId: 'v2.0.0', isDefault: true, activeExecutions: 10 },
                ],
                message: 'Found 2 Build IDs',
            });
            expect(result.success).toBe(true);
        });
    });
});
