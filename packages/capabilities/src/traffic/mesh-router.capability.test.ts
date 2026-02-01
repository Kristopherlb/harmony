/**
 * packages/capabilities/src/traffic/mesh-router.capability.test.ts
 * TCS-001 contract verification for Mesh Router capability.
 */
import { describe, it, expect } from 'vitest';
import { meshRouterCapability } from './mesh-router.capability.js';

describe('meshRouterCapability', () => {
    describe('TCS-001 contract verification', () => {
        it('validates aiHints examples against input schema', () => {
            expect(() =>
                meshRouterCapability.schemas.input.parse(meshRouterCapability.aiHints.exampleInput)
            ).not.toThrow();
        });

        it('validates aiHints examples against output schema', () => {
            expect(() =>
                meshRouterCapability.schemas.output.parse(meshRouterCapability.aiHints.exampleOutput)
            ).not.toThrow();
        });

        it('has required OCS metadata fields', () => {
            expect(meshRouterCapability.metadata.id).toBe('golden.traffic.mesh-router');
            expect(meshRouterCapability.metadata.version).toMatch(/^\d+\.\d+\.\d+$/);
            expect(meshRouterCapability.metadata.name).toBe('meshRouter');
            expect(meshRouterCapability.metadata.description).toBeTruthy();
            expect(meshRouterCapability.metadata.tags).toContain('traffic');
            expect(meshRouterCapability.metadata.tags).toContain('service-mesh');
        });

        it('declares correct network access for Kubernetes', () => {
            expect(meshRouterCapability.security.networkAccess.allowOutbound).toContain('kubernetes.default.svc');
        });

        it('requires mesh:write scope', () => {
            expect(meshRouterCapability.security.requiredScopes).toContain('mesh:write');
        });
    });

    describe('factory - set-weights operation', () => {
        it('builds a Dagger container for weight update', () => {
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

            meshRouterCapability.factory(
                fakeDag,
                {
                    ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
                    config: {},
                    secretRefs: {},
                },
                {
                    operation: 'set-weights',
                    service: 'harmony-mcp',
                    namespace: 'production',
                    weights: { stable: 90, canary: 10 },
                }
            );

            expect(calls.from[0]).toContain('kubectl');
            expect(calls.env.some((e) => e.key === 'OPERATION' && e.value === 'set-weights')).toBe(true);
            expect(calls.env.some((e) => e.key === 'SERVICE' && e.value === 'harmony-mcp')).toBe(true);
            expect(calls.env.some((e) => e.key === 'NAMESPACE' && e.value === 'production')).toBe(true);
        });
    });

    describe('factory - header-route operation', () => {
        it('builds a Dagger container for header routing', () => {
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

            meshRouterCapability.factory(
                fakeDag,
                {
                    ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
                    config: {},
                    secretRefs: {},
                },
                {
                    operation: 'header-route',
                    service: 'harmony-mcp',
                    headerMatch: {
                        header: 'x-version',
                        value: 'canary',
                        subset: 'canary',
                    },
                }
            );

            expect(calls.env.some((e) => e.key === 'OPERATION' && e.value === 'header-route')).toBe(true);
        });
    });

    describe('schema validation', () => {
        it('accepts all operations', () => {
            const operations = ['set-weights', 'header-route', 'get-status', 'reset'];

            for (const operation of operations) {
                expect(() =>
                    meshRouterCapability.schemas.input.parse({
                        operation,
                        service: 'test-service',
                    })
                ).not.toThrow();
            }
        });

        it('accepts all mesh types', () => {
            const meshTypes = ['istio', 'linkerd'];

            for (const meshType of meshTypes) {
                expect(() =>
                    meshRouterCapability.schemas.input.parse({
                        operation: 'get-status',
                        service: 'test-service',
                        meshType,
                    })
                ).not.toThrow();
            }
        });

        it('enforces weights must sum to 100', () => {
            expect(() =>
                meshRouterCapability.schemas.input.parse({
                    operation: 'set-weights',
                    service: 'test-service',
                    weights: { stable: 80, canary: 30 }, // sum = 110
                })
            ).toThrow();

            expect(() =>
                meshRouterCapability.schemas.input.parse({
                    operation: 'set-weights',
                    service: 'test-service',
                    weights: { stable: 90, canary: 10 }, // sum = 100
                })
            ).not.toThrow();
        });

        it('enforces weight bounds', () => {
            expect(() =>
                meshRouterCapability.schemas.input.parse({
                    operation: 'set-weights',
                    service: 'test-service',
                    weights: { stable: -10, canary: 110 },
                })
            ).toThrow();
        });

        it('accepts header match configuration', () => {
            expect(() =>
                meshRouterCapability.schemas.input.parse({
                    operation: 'header-route',
                    service: 'test-service',
                    headerMatch: {
                        header: 'x-canary',
                        value: 'true',
                        matchType: 'exact',
                        subset: 'canary',
                    },
                })
            ).not.toThrow();
        });

        it('accepts valid output with routes', () => {
            const result = meshRouterCapability.schemas.output.safeParse({
                success: true,
                operation: 'get-status',
                service: 'harmony-mcp',
                namespace: 'production',
                meshType: 'istio',
                currentWeights: { stable: 90, canary: 10 },
                routes: [
                    { subset: 'stable', weight: 90, endpoints: 3 },
                    { subset: 'canary', weight: 10, endpoints: 1 },
                ],
                message: 'Retrieved routing status',
            });
            expect(result.success).toBe(true);
        });

        it('accepts valid output with header routes', () => {
            const result = meshRouterCapability.schemas.output.safeParse({
                success: true,
                operation: 'header-route',
                service: 'harmony-mcp',
                namespace: 'default',
                meshType: 'istio',
                headerRoutes: [
                    {
                        header: 'x-version',
                        value: 'v2',
                        matchType: 'exact',
                        subset: 'canary',
                    },
                ],
                message: 'Configured header routing',
            });
            expect(result.success).toBe(true);
        });
    });
});
