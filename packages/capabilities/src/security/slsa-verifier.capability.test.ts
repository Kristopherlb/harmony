/**
 * packages/capabilities/src/security/slsa-verifier.capability.test.ts
 * TCS-001 contract verification for SLSA Verifier capability.
 */
import { describe, it, expect } from 'vitest';
import { slsaVerifierCapability } from './slsa-verifier.capability.js';

describe('slsaVerifierCapability', () => {
    describe('TCS-001 contract verification', () => {
        it('validates aiHints examples against input schema', () => {
            expect(() =>
                slsaVerifierCapability.schemas.input.parse(slsaVerifierCapability.aiHints.exampleInput)
            ).not.toThrow();
        });

        it('validates aiHints examples against output schema', () => {
            expect(() =>
                slsaVerifierCapability.schemas.output.parse(slsaVerifierCapability.aiHints.exampleOutput)
            ).not.toThrow();
        });

        it('has required OCS metadata fields', () => {
            expect(slsaVerifierCapability.metadata.id).toBe('golden.security.slsa-verifier');
            expect(slsaVerifierCapability.metadata.version).toMatch(/^\d+\.\d+\.\d+$/);
            expect(slsaVerifierCapability.metadata.name).toBe('slsaVerifier');
            expect(slsaVerifierCapability.metadata.tags).toContain('slsa');
            expect(slsaVerifierCapability.metadata.tags).toContain('openssf');
        });

        it('declares correct network access', () => {
            expect(slsaVerifierCapability.security.networkAccess.allowOutbound).toContain('rekor.sigstore.dev');
            expect(slsaVerifierCapability.security.networkAccess.allowOutbound).toContain('ghcr.io');
        });
    });

    describe('schema validation', () => {
        it('accepts all operations', () => {
            const operations = ['verify-artifact', 'verify-image', 'verify-npm', 'inspect-provenance'];
            for (const operation of operations) {
                expect(() =>
                    slsaVerifierCapability.schemas.input.parse({ operation })
                ).not.toThrow();
            }
        });

        it('accepts all SLSA levels', () => {
            const levels = ['1', '2', '3', '4'];
            for (const minSlsaLevel of levels) {
                expect(() =>
                    slsaVerifierCapability.schemas.input.parse({ operation: 'verify-image', minSlsaLevel })
                ).not.toThrow();
            }
        });

        it('accepts valid verification output with subjects', () => {
            const result = slsaVerifierCapability.schemas.output.safeParse({
                success: true,
                operation: 'inspect-provenance',
                subjects: [
                    { name: 'artifact.tar.gz', digest: { sha256: 'abc123' } },
                ],
                message: 'Provenance inspected',
            });
            expect(result.success).toBe(true);
        });
    });

    describe('factory function', () => {
        it('builds a Dagger container for image verification', () => {
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

            slsaVerifierCapability.factory(
                fakeDag,
                {
                    ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
                    config: {},
                    secretRefs: {},
                },
                {
                    operation: 'verify-image',
                    imageRef: 'ghcr.io/org/image:v1.0.0',
                }
            );

            expect(calls.from[0]).toContain('slsa-verifier');
            expect(calls.env.some((e) => e.key === 'OPERATION' && e.value === 'verify-image')).toBe(true);
        });
    });
});
