/**
 * packages/capabilities/src/security/guac.capability.test.ts
 * TCS-001 contract verification for GUAC capability.
 */
import { describe, it, expect } from 'vitest';
import { guacCapability } from './guac.capability.js';

describe('guacCapability', () => {
    describe('TCS-001 contract verification', () => {
        it('validates aiHints examples against input schema', () => {
            expect(() =>
                guacCapability.schemas.input.parse(guacCapability.aiHints.exampleInput)
            ).not.toThrow();
        });

        it('validates aiHints examples against output schema', () => {
            expect(() =>
                guacCapability.schemas.output.parse(guacCapability.aiHints.exampleOutput)
            ).not.toThrow();
        });

        it('has required OCS metadata fields', () => {
            expect(guacCapability.metadata.id).toBe('golden.security.guac');
            expect(guacCapability.metadata.version).toMatch(/^\d+\.\d+\.\d+$/);
            expect(guacCapability.metadata.name).toBe('guac');
            expect(guacCapability.metadata.tags).toContain('openssf');
            expect(guacCapability.metadata.tags).toContain('supply-chain');
        });

        it('has OSCAL control mappings', () => {
            expect(guacCapability.security.oscalControlIds).toContain('SA-12');
        });
    });

    describe('schema validation', () => {
        it('accepts all operations', () => {
            const operations = [
                'ingest-sbom', 'ingest-slsa', 'query-deps', 'query-vulns',
                'query-path', 'certify-good', 'certify-bad',
            ];
            for (const operation of operations) {
                expect(() =>
                    guacCapability.schemas.input.parse({ operation })
                ).not.toThrow();
            }
        });

        it('accepts query with purl', () => {
            const result = guacCapability.schemas.input.safeParse({
                operation: 'query-deps',
                purl: 'pkg:npm/lodash@4.17.21',
                depth: 5,
            });
            expect(result.success).toBe(true);
        });

        it('accepts certification with justification', () => {
            const result = guacCapability.schemas.input.safeParse({
                operation: 'certify-good',
                purl: 'pkg:npm/@harmony/core@1.0.0',
                justification: 'Verified by security team',
            });
            expect(result.success).toBe(true);
        });
    });

    describe('factory function', () => {
        it('builds a Dagger container for queries', () => {
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

            guacCapability.factory(
                fakeDag,
                {
                    ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
                    config: { guacUrl: 'http://guac.internal/query' },
                    secretRefs: {},
                },
                {
                    operation: 'query-vulns',
                    purl: 'pkg:npm/lodash@4.17.21',
                }
            );

            expect(calls.from[0]).toContain('guac');
            expect(calls.env.some((e) => e.key === 'OPERATION' && e.value === 'query-vulns')).toBe(true);
        });
    });
});
