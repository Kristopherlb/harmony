/**
 * packages/capabilities/src/flags/flagd-sync.capability.test.ts
 * TCS-001 contract verification for flagd Sync capability.
 */
import { describe, it, expect } from 'vitest';
import { flagdSyncCapability } from './flagd-sync.capability.js';

describe('flagdSyncCapability', () => {
    describe('TCS-001 contract verification', () => {
        it('validates aiHints examples against input schema', () => {
            expect(() =>
                flagdSyncCapability.schemas.input.parse(flagdSyncCapability.aiHints.exampleInput)
            ).not.toThrow();
        });

        it('validates aiHints examples against output schema', () => {
            expect(() =>
                flagdSyncCapability.schemas.output.parse(flagdSyncCapability.aiHints.exampleOutput)
            ).not.toThrow();
        });

        it('has required OCS metadata fields', () => {
            expect(flagdSyncCapability.metadata.id).toBe('golden.flags.flagd-sync');
            expect(flagdSyncCapability.metadata.version).toMatch(/^\d+\.\d+\.\d+$/);
            expect(flagdSyncCapability.metadata.name).toBe('flagdSync');
            expect(flagdSyncCapability.metadata.description).toBeTruthy();
            expect(flagdSyncCapability.metadata.tags).toContain('flags');
            expect(flagdSyncCapability.metadata.tags).toContain('kubernetes');
        });

        it('declares correct network access for Kubernetes', () => {
            expect(flagdSyncCapability.security.networkAccess.allowOutbound).toContain('kubernetes.default.svc');
        });

        it('requires flags:write and k8s:write scopes', () => {
            expect(flagdSyncCapability.security.requiredScopes).toContain('flags:write');
            expect(flagdSyncCapability.security.requiredScopes).toContain('k8s:write');
        });
    });

    describe('factory - sync operation', () => {
        it('builds a Dagger container for ConfigMap sync', () => {
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

            flagdSyncCapability.factory(
                fakeDag,
                {
                    ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
                    config: {},
                    secretRefs: {},
                },
                {
                    operation: 'sync',
                    version: '2.0.0',
                    namespace: 'production',
                }
            );

            expect(calls.from[0]).toContain('kubectl');
            expect(calls.env.some((e) => e.key === 'OPERATION' && e.value === 'sync')).toBe(true);
            expect(calls.env.some((e) => e.key === 'NAMESPACE' && e.value === 'production')).toBe(true);
        });
    });

    describe('factory - validate operation', () => {
        it('builds a Dagger container for validation', () => {
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

            flagdSyncCapability.factory(
                fakeDag,
                {
                    ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
                    config: {},
                    secretRefs: {},
                },
                {
                    operation: 'validate',
                    configPath: 'deploy/flagd/flags.json',
                }
            );

            expect(calls.env.some((e) => e.key === 'OPERATION' && e.value === 'validate')).toBe(true);
        });
    });

    describe('schema validation', () => {
        it('accepts all operations', () => {
            const operations = ['sync', 'validate', 'diff', 'apply'];

            for (const operation of operations) {
                expect(() =>
                    flagdSyncCapability.schemas.input.parse({ operation })
                ).not.toThrow();
            }
        });

        it('allows optional fields to be omitted', () => {
            const result = flagdSyncCapability.schemas.input.parse({
                operation: 'sync',
            });
            // These fields are optional - defaults are applied in factory, not schema
            expect(result.configPath).toBeUndefined();
            expect(result.namespace).toBeUndefined();
            expect(result.configMapName).toBeUndefined();
        });

        it('accepts dry run option', () => {
            expect(() =>
                flagdSyncCapability.schemas.input.parse({
                    operation: 'sync',
                    dryRun: true,
                })
            ).not.toThrow();
        });

        it('accepts valid output with changed flags', () => {
            const result = flagdSyncCapability.schemas.output.safeParse({
                status: 'SYNCED',
                operation: 'sync',
                flagsCount: 10,
                changedFlags: [
                    {
                        flagKey: 'cap-golden.trivy-enabled',
                        changeType: 'added',
                        newValue: { state: 'ENABLED' },
                    },
                    {
                        flagKey: 'release-1.0.0-enabled',
                        changeType: 'deleted',
                        oldValue: { state: 'DISABLED' },
                    },
                    {
                        flagKey: 'release-2.0.0-enabled',
                        changeType: 'modified',
                        oldValue: { state: 'DISABLED' },
                        newValue: { state: 'ENABLED' },
                    },
                ],
                configMapName: 'flagd-flags',
                namespace: 'production',
                message: 'Synced 10 flags',
            });
            expect(result.success).toBe(true);
        });

        it('accepts output with validation errors', () => {
            const result = flagdSyncCapability.schemas.output.safeParse({
                status: 'FAILED',
                operation: 'validate',
                flagsCount: 0,
                validationErrors: [
                    'Missing required flags field',
                    'Invalid JSON structure',
                ],
                message: 'Validation failed',
            });
            expect(result.success).toBe(true);
        });
    });
});
