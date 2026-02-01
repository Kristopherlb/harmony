/**
 * packages/capabilities/src/security/osv-scanner.capability.test.ts
 * TCS-001 contract verification for OSV Scanner capability.
 */
import { describe, it, expect } from 'vitest';
import { osvScannerCapability } from './osv-scanner.capability.js';

describe('osvScannerCapability', () => {
    describe('TCS-001 contract verification', () => {
        it('validates aiHints examples against input schema', () => {
            expect(() =>
                osvScannerCapability.schemas.input.parse(osvScannerCapability.aiHints.exampleInput)
            ).not.toThrow();
        });

        it('validates aiHints examples against output schema', () => {
            expect(() =>
                osvScannerCapability.schemas.output.parse(osvScannerCapability.aiHints.exampleOutput)
            ).not.toThrow();
        });

        it('has required OCS metadata fields', () => {
            expect(osvScannerCapability.metadata.id).toBe('golden.security.osv-scanner');
            expect(osvScannerCapability.metadata.version).toMatch(/^\d+\.\d+\.\d+$/);
            expect(osvScannerCapability.metadata.name).toBe('osvScanner');
            expect(osvScannerCapability.metadata.description).toBeTruthy();
            expect(osvScannerCapability.metadata.tags).toContain('openssf');
        });

        it('declares network access for OSV API', () => {
            expect(osvScannerCapability.security.networkAccess.allowOutbound).toContain('api.osv.dev');
        });
    });

    describe('factory - lockfile scan', () => {
        it('builds a Dagger container for lockfile scanning', () => {
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

            osvScannerCapability.factory(
                fakeDag,
                {
                    ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
                    config: {},
                    secretRefs: {},
                },
                {
                    sourceType: 'lockfile',
                    source: '/path/to/package-lock.json',
                }
            );

            expect(calls.from[0]).toContain('osv-scanner');
            expect(calls.env.some((e) => e.key === 'SOURCE_TYPE' && e.value === 'lockfile')).toBe(true);
            expect(calls.env.some((e) => e.key === 'SOURCE')).toBe(true);
        });
    });

    describe('factory - directory scan', () => {
        it('builds a Dagger container for directory scanning', () => {
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

            osvScannerCapability.factory(
                fakeDag,
                {
                    ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
                    config: {},
                    secretRefs: {},
                },
                {
                    sourceType: 'directory',
                    source: '/path/to/project',
                    recursive: true,
                }
            );

            expect(calls.env.some((e) => e.key === 'SOURCE_TYPE' && e.value === 'directory')).toBe(true);
        });
    });

    describe('schema validation', () => {
        it('accepts all source types', () => {
            const sourceTypes = ['lockfile', 'sbom', 'directory', 'purl'];

            for (const sourceType of sourceTypes) {
                expect(() =>
                    osvScannerCapability.schemas.input.parse({ sourceType, source: 'test' })
                ).not.toThrow();
            }
        });

        it('accepts all ecosystems', () => {
            const ecosystems = ['npm', 'pypi', 'go', 'maven', 'cargo', 'nuget', 'packagist', 'rubygems', 'pub', 'hex'];

            for (const ecosystem of ecosystems) {
                expect(() =>
                    osvScannerCapability.schemas.input.parse({
                        sourceType: 'lockfile',
                        source: 'test',
                        ecosystem,
                    })
                ).not.toThrow();
            }
        });
    });
});
