/**
 * packages/capabilities/src/security/grype.capability.test.ts
 * TCS-001 contract verification for Grype capability.
 */
import { describe, it, expect } from 'vitest';
import { grypeCapability } from './grype.capability.js';

describe('grypeCapability', () => {
    describe('TCS-001 contract verification', () => {
        it('validates aiHints examples against input schema', () => {
            expect(() =>
                grypeCapability.schemas.input.parse(grypeCapability.aiHints.exampleInput)
            ).not.toThrow();
        });

        it('validates aiHints examples against output schema', () => {
            expect(() =>
                grypeCapability.schemas.output.parse(grypeCapability.aiHints.exampleOutput)
            ).not.toThrow();
        });

        it('has required OCS metadata fields', () => {
            expect(grypeCapability.metadata.id).toBe('golden.security.grype');
            expect(grypeCapability.metadata.version).toMatch(/^\d+\.\d+\.\d+$/);
            expect(grypeCapability.metadata.name).toBe('grype');
            expect(grypeCapability.metadata.description).toBeTruthy();
            expect(grypeCapability.metadata.tags).toContain('security');
            expect(grypeCapability.metadata.tags).toContain('vulnerability');
        });

        it('declares network access for registries and vuln DB', () => {
            expect(grypeCapability.security.networkAccess.allowOutbound).toContain('toolbox-data.anchore.io');
            expect(grypeCapability.security.networkAccess.allowOutbound).toContain('*.docker.io');
        });
    });

    describe('factory - image scan', () => {
        it('builds a Dagger container for image vulnerability scan', () => {
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

            grypeCapability.factory(
                fakeDag,
                {
                    ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
                    config: {},
                    secretRefs: {},
                },
                {
                    sourceType: 'image',
                    source: 'alpine:3.18',
                    failOnSeverity: 'high',
                }
            );

            expect(calls.from[0]).toContain('grype');
            expect(calls.env.some((e) => e.key === 'SOURCE_TYPE' && e.value === 'image')).toBe(true);
            expect(calls.env.some((e) => e.key === 'SOURCE' && e.value === 'alpine:3.18')).toBe(true);
        });
    });

    describe('factory - SBOM scan', () => {
        it('builds a Dagger container for SBOM vulnerability scan', () => {
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

            grypeCapability.factory(
                fakeDag,
                {
                    ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
                    config: {},
                    secretRefs: {},
                },
                {
                    sourceType: 'sbom',
                    source: '/path/to/sbom.json',
                }
            );

            expect(calls.env.some((e) => e.key === 'SOURCE_TYPE' && e.value === 'sbom')).toBe(true);
        });
    });

    describe('schema validation', () => {
        it('accepts all source types', () => {
            const sourceTypes = ['image', 'directory', 'file', 'sbom', 'registry'];

            for (const sourceType of sourceTypes) {
                expect(() =>
                    grypeCapability.schemas.input.parse({ sourceType, source: 'test' })
                ).not.toThrow();
            }
        });

        it('accepts all severity levels for failOnSeverity', () => {
            const severities = ['negligible', 'low', 'medium', 'high', 'critical'];

            for (const severity of severities) {
                expect(() =>
                    grypeCapability.schemas.input.parse({
                        sourceType: 'image',
                        source: 'alpine',
                        failOnSeverity: severity,
                    })
                ).not.toThrow();
            }
        });
    });
});
