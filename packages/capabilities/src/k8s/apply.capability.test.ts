/**
 * packages/capabilities/src/k8s/apply.capability.test.ts
 * TCS-001 contract verification for Kubernetes Apply capability.
 */
import { describe, it, expect } from 'vitest';
import { k8sApplyCapability } from './apply.capability.js';

describe('k8sApplyCapability', () => {
    describe('TCS-001 contract verification', () => {
        it('validates aiHints examples against input schema', () => {
            expect(() =>
                k8sApplyCapability.schemas.input.parse(k8sApplyCapability.aiHints.exampleInput)
            ).not.toThrow();
        });

        it('validates aiHints examples against output schema', () => {
            expect(() =>
                k8sApplyCapability.schemas.output.parse(k8sApplyCapability.aiHints.exampleOutput)
            ).not.toThrow();
        });

        it('has required OCS metadata fields', () => {
            expect(k8sApplyCapability.metadata.id).toBe('golden.k8s.apply');
            expect(k8sApplyCapability.metadata.version).toMatch(/^\d+\.\d+\.\d+$/);
            expect(k8sApplyCapability.metadata.name).toBe('k8sApply');
            expect(k8sApplyCapability.metadata.description).toBeTruthy();
            expect(k8sApplyCapability.metadata.tags).toContain('kubernetes');
            expect(k8sApplyCapability.metadata.tags).toContain('deployment');
        });

        it('declares correct network access for Kubernetes', () => {
            expect(k8sApplyCapability.security.networkAccess.allowOutbound).toContain('kubernetes.default.svc');
        });

        it('requires k8s:write scope', () => {
            expect(k8sApplyCapability.security.requiredScopes).toContain('k8s:write');
        });
    });

    describe('factory - apply operation', () => {
        it('builds a Dagger container for manifest application', () => {
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

            k8sApplyCapability.factory(
                fakeDag,
                {
                    ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
                    config: {},
                    secretRefs: {},
                },
                {
                    operation: 'apply',
                    manifestPath: 'deploy/k8s',
                    namespace: 'production',
                    substitutions: { BUILD_ID: 'v2.0.0' },
                }
            );

            expect(calls.from[0]).toContain('kubectl');
            expect(calls.env.some((e) => e.key === 'OPERATION' && e.value === 'apply')).toBe(true);
            expect(calls.env.some((e) => e.key === 'NAMESPACE' && e.value === 'production')).toBe(true);
        });
    });

    describe('factory - rollout-restart operation', () => {
        it('builds a Dagger container for rollout restart', () => {
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

            k8sApplyCapability.factory(
                fakeDag,
                {
                    ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
                    config: {},
                    secretRefs: {},
                },
                {
                    operation: 'rollout-restart',
                    namespace: 'default',
                    resourceType: 'deployment',
                    resourceName: 'harmony-worker',
                }
            );

            expect(calls.env.some((e) => e.key === 'OPERATION' && e.value === 'rollout-restart')).toBe(true);
        });
    });

    describe('schema validation', () => {
        it('accepts all operations', () => {
            const operations = ['apply', 'delete', 'rollout-restart', 'get-status'];

            for (const operation of operations) {
                expect(() =>
                    k8sApplyCapability.schemas.input.parse({
                        operation,
                    })
                ).not.toThrow();
            }
        });

        it('accepts inline manifests', () => {
            expect(() =>
                k8sApplyCapability.schemas.input.parse({
                    operation: 'apply',
                    manifests: ['apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: test'],
                    namespace: 'default',
                })
            ).not.toThrow();
        });

        it('accepts valid resource status output', () => {
            const result = k8sApplyCapability.schemas.output.safeParse({
                success: true,
                operation: 'get-status',
                namespace: 'default',
                resourcesAffected: 2,
                resources: [
                    {
                        kind: 'Deployment',
                        name: 'worker-v1',
                        namespace: 'default',
                        status: 'ready',
                        replicas: 3,
                        readyReplicas: 3,
                    },
                    {
                        kind: 'Deployment',
                        name: 'worker-v2',
                        namespace: 'default',
                        status: 'pending',
                        replicas: 3,
                        readyReplicas: 1,
                    },
                ],
                message: 'Retrieved status of 2 deployments',
            });
            expect(result.success).toBe(true);
        });
    });
});
