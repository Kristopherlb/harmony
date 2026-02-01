/**
 * packages/capabilities/src/ci/container-builder.capability.test.ts
 * TCS-001 contract verification for Container Builder capability.
 */
import { describe, it, expect } from 'vitest';
import { containerBuilderCapability } from './container-builder.capability.js';

describe('containerBuilderCapability', () => {
    describe('TCS-001 contract verification', () => {
        it('validates aiHints examples against input schema', () => {
            expect(() =>
                containerBuilderCapability.schemas.input.parse(containerBuilderCapability.aiHints.exampleInput)
            ).not.toThrow();
        });

        it('validates aiHints examples against output schema', () => {
            expect(() =>
                containerBuilderCapability.schemas.output.parse(containerBuilderCapability.aiHints.exampleOutput)
            ).not.toThrow();
        });

        it('has required OCS metadata fields', () => {
            expect(containerBuilderCapability.metadata.id).toBe('golden.ci.container-builder');
            expect(containerBuilderCapability.metadata.version).toMatch(/^\d+\.\d+\.\d+$/);
            expect(containerBuilderCapability.metadata.name).toBe('containerBuilder');
            expect(containerBuilderCapability.metadata.description).toBeTruthy();
            expect(containerBuilderCapability.metadata.tags).toContain('ci');
            expect(containerBuilderCapability.metadata.tags).toContain('containers');
        });

        it('declares correct network access for registries', () => {
            expect(containerBuilderCapability.security.networkAccess.allowOutbound).toContain('ghcr.io');
            expect(containerBuilderCapability.security.networkAccess.allowOutbound).toContain('*.docker.io');
        });

        it('requires ci:build scope', () => {
            expect(containerBuilderCapability.security.requiredScopes).toContain('ci:build');
        });
    });

    describe('factory - build operation', () => {
        it('builds a Dagger container for image building', () => {
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

            containerBuilderCapability.factory(
                fakeDag,
                {
                    ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
                    config: {},
                    secretRefs: {},
                },
                {
                    operation: 'build',
                    context: 'packages/blueprints',
                    tags: ['test-image:v1.0.0'],
                }
            );

            expect(calls.from[0]).toContain('docker');
            expect(calls.env.some((e) => e.key === 'OPERATION' && e.value === 'build')).toBe(true);
            expect(calls.env.some((e) => e.key === 'CONTEXT_PATH' && e.value === 'packages/blueprints')).toBe(true);
        });
    });

    describe('factory - build-and-push operation', () => {
        it('builds a Dagger container for build and push', () => {
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

            containerBuilderCapability.factory(
                fakeDag,
                {
                    ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
                    config: { defaultRegistry: 'ghcr.io' },
                    secretRefs: {},
                },
                {
                    operation: 'build-and-push',
                    context: '.',
                    tags: ['ghcr.io/org/app:v2.0.0'],
                    buildArgs: { VERSION: '2.0.0' },
                }
            );

            expect(calls.env.some((e) => e.key === 'OPERATION' && e.value === 'build-and-push')).toBe(true);
        });
    });

    describe('schema validation', () => {
        it('accepts all operations', () => {
            const operations = ['build', 'build-and-push'];

            for (const operation of operations) {
                expect(() =>
                    containerBuilderCapability.schemas.input.parse({
                        operation,
                        context: '.',
                        tags: ['image:latest'],
                    })
                ).not.toThrow();
            }
        });

        it('requires at least one tag', () => {
            expect(() =>
                containerBuilderCapability.schemas.input.parse({
                    operation: 'build',
                    context: '.',
                    tags: [],
                })
            ).toThrow();
        });

        it('accepts multi-stage build input', () => {
            expect(() =>
                containerBuilderCapability.schemas.input.parse({
                    operation: 'build',
                    context: '.',
                    dockerfile: 'Dockerfile.prod',
                    target: 'production',
                    tags: ['myapp:prod'],
                    buildArgs: { NODE_ENV: 'production' },
                    labels: { 'org.opencontainers.image.version': '1.0.0' },
                })
            ).not.toThrow();
        });

        it('accepts valid output with digest', () => {
            const result = containerBuilderCapability.schemas.output.safeParse({
                imageRef: 'ghcr.io/org/app:v1.0.0',
                digest: 'sha256:abc123',
                size: 150000000,
                tags: ['ghcr.io/org/app:v1.0.0', 'ghcr.io/org/app:latest'],
                buildDuration: 30000,
                pushed: true,
                layers: 10,
            });
            expect(result.success).toBe(true);
        });
    });
});
