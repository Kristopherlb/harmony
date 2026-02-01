/**
 * packages/capabilities/src/sbom/syft.capability.test.ts
 * TCS-001 contract verification for Syft SBOM capability.
 */
import { describe, it, expect } from 'vitest';
import { syftCapability } from './syft.capability.js';

describe('syftCapability', () => {
    describe('TCS-001 contract verification', () => {
        it('validates aiHints examples against input schema', () => {
            expect(() =>
                syftCapability.schemas.input.parse(syftCapability.aiHints.exampleInput)
            ).not.toThrow();
        });

        it('validates aiHints examples against output schema', () => {
            expect(() =>
                syftCapability.schemas.output.parse(syftCapability.aiHints.exampleOutput)
            ).not.toThrow();
        });

        it('has required OCS metadata fields', () => {
            expect(syftCapability.metadata.id).toBe('golden.sbom.syft');
            expect(syftCapability.metadata.version).toMatch(/^\d+\.\d+\.\d+$/);
            expect(syftCapability.metadata.name).toBe('syft');
            expect(syftCapability.metadata.description).toBeTruthy();
            expect(syftCapability.metadata.tags).toContain('sbom');
        });

        it('declares network access for container registries', () => {
            expect(syftCapability.security.networkAccess.allowOutbound).toContain('*.docker.io');
            expect(syftCapability.security.networkAccess.allowOutbound).toContain('ghcr.io');
        });
    });

    describe('factory - image scan', () => {
        it('builds a Dagger container for image SBOM generation', () => {
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

            syftCapability.factory(
                fakeDag,
                {
                    ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
                    config: {},
                    secretRefs: {},
                },
                {
                    sourceType: 'image',
                    source: 'alpine:3.18',
                    format: 'cyclonedx-json',
                }
            );

            expect(calls.from[0]).toContain('syft');
            expect(calls.env.some((e) => e.key === 'SOURCE_TYPE' && e.value === 'image')).toBe(true);
            expect(calls.env.some((e) => e.key === 'SOURCE' && e.value === 'alpine:3.18')).toBe(true);
            expect(calls.env.some((e) => e.key === 'FORMAT' && e.value === 'cyclonedx-json')).toBe(true);
        });
    });

    describe('factory - directory scan', () => {
        it('builds a Dagger container for directory SBOM generation', () => {
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

            syftCapability.factory(
                fakeDag,
                {
                    ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
                    config: {},
                    secretRefs: {},
                },
                {
                    sourceType: 'directory',
                    source: '/path/to/project',
                    format: 'spdx-json',
                }
            );

            expect(calls.env.some((e) => e.key === 'SOURCE_TYPE' && e.value === 'directory')).toBe(true);
            expect(calls.env.some((e) => e.key === 'FORMAT' && e.value === 'spdx-json')).toBe(true);
        });
    });

    describe('schema validation', () => {
        it('accepts all source types', () => {
            const sourceTypes = ['image', 'directory', 'file', 'registry'];

            for (const sourceType of sourceTypes) {
                expect(() =>
                    syftCapability.schemas.input.parse({ sourceType, source: 'test' })
                ).not.toThrow();
            }
        });

        it('accepts all output formats', () => {
            const formats = [
                'spdx-json',
                'cyclonedx-json',
                'syft-json',
                'spdx-tag-value',
                'cyclonedx-xml',
                'github-json',
                'table',
            ];

            for (const format of formats) {
                expect(() =>
                    syftCapability.schemas.input.parse({
                        sourceType: 'image',
                        source: 'alpine',
                        format,
                    })
                ).not.toThrow();
            }
        });
    });
});
