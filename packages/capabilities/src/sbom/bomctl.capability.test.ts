/**
 * packages/capabilities/src/sbom/bomctl.capability.test.ts
 * TCS-001 contract verification for Bomctl capability.
 */
import { describe, it, expect } from 'vitest';
import { bomctlCapability } from './bomctl.capability.js';

describe('bomctlCapability', () => {
    describe('TCS-001 contract verification', () => {
        it('validates aiHints examples against input schema', () => {
            expect(() =>
                bomctlCapability.schemas.input.parse(bomctlCapability.aiHints.exampleInput)
            ).not.toThrow();
        });

        it('validates aiHints examples against output schema', () => {
            expect(() =>
                bomctlCapability.schemas.output.parse(bomctlCapability.aiHints.exampleOutput)
            ).not.toThrow();
        });

        it('has required OCS metadata fields', () => {
            expect(bomctlCapability.metadata.id).toBe('golden.sbom.bomctl');
            expect(bomctlCapability.metadata.version).toMatch(/^\d+\.\d+\.\d+$/);
            expect(bomctlCapability.metadata.name).toBe('bomctl');
            expect(bomctlCapability.metadata.tags).toContain('sbom');
            expect(bomctlCapability.metadata.tags).toContain('openssf');
        });
    });

    describe('schema validation', () => {
        it('accepts all operations', () => {
            const operations = ['merge', 'diff', 'fetch', 'push', 'list', 'import', 'export'];
            for (const operation of operations) {
                expect(() =>
                    bomctlCapability.schemas.input.parse({ operation })
                ).not.toThrow();
            }
        });

        it('accepts all output formats', () => {
            const formats = ['spdx-json', 'cyclonedx-json', 'spdx-tv'];
            for (const outputFormat of formats) {
                expect(() =>
                    bomctlCapability.schemas.input.parse({ operation: 'merge', outputFormat })
                ).not.toThrow();
            }
        });

        it('accepts diff output with components', () => {
            const result = bomctlCapability.schemas.output.safeParse({
                success: true,
                operation: 'diff',
                diff: {
                    added: [{ name: 'new-pkg', version: '1.0.0' }],
                    removed: [{ name: 'old-pkg', version: '0.9.0' }],
                    modified: [],
                },
                message: 'Diff complete',
            });
            expect(result.success).toBe(true);
        });
    });

    describe('factory function', () => {
        it('builds a Dagger container for merge', () => {
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

            bomctlCapability.factory(
                fakeDag,
                {
                    ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
                    config: {},
                    secretRefs: {},
                },
                {
                    operation: 'merge',
                    sbomPaths: ['sbom1.json', 'sbom2.json'],
                }
            );

            expect(calls.from[0]).toContain('bomctl');
            expect(calls.env.some((e) => e.key === 'OPERATION' && e.value === 'merge')).toBe(true);
        });
    });
});
