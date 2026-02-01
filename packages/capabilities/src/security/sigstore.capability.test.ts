/**
 * packages/capabilities/src/security/sigstore.capability.test.ts
 * TCS-001 contract verification for Sigstore capability.
 */
import { describe, it, expect } from 'vitest';
import { sigstoreCapability } from './sigstore.capability.js';

describe('sigstoreCapability', () => {
    describe('TCS-001 contract verification', () => {
        it('validates aiHints examples against input schema', () => {
            expect(() =>
                sigstoreCapability.schemas.input.parse(sigstoreCapability.aiHints.exampleInput)
            ).not.toThrow();
        });

        it('validates aiHints examples against output schema', () => {
            expect(() =>
                sigstoreCapability.schemas.output.parse(sigstoreCapability.aiHints.exampleOutput)
            ).not.toThrow();
        });

        it('has required OCS metadata fields', () => {
            expect(sigstoreCapability.metadata.id).toBe('golden.security.sigstore');
            expect(sigstoreCapability.metadata.version).toMatch(/^\d+\.\d+\.\d+$/);
            expect(sigstoreCapability.metadata.name).toBe('sigstore');
            expect(sigstoreCapability.metadata.description).toBeTruthy();
            expect(sigstoreCapability.metadata.tags).toContain('security');
            expect(sigstoreCapability.metadata.tags).toContain('openssf');
        });

        it('declares correct network access for Sigstore services', () => {
            expect(sigstoreCapability.security.networkAccess.allowOutbound).toContain('fulcio.sigstore.dev');
            expect(sigstoreCapability.security.networkAccess.allowOutbound).toContain('rekor.sigstore.dev');
        });

        it('has OSCAL control mappings', () => {
            expect(sigstoreCapability.security.oscalControlIds).toContain('SA-12');
            expect(sigstoreCapability.security.oscalControlIds).toContain('SI-7');
        });
    });

    describe('schema validation', () => {
        it('accepts all operations', () => {
            const operations = ['sign', 'verify', 'attest', 'verify-attest'];
            for (const operation of operations) {
                expect(() =>
                    sigstoreCapability.schemas.input.parse({ operation })
                ).not.toThrow();
            }
        });

        it('accepts output formats', () => {
            const formats = ['bundle', 'signature', 'certificate'];
            for (const outputFormat of formats) {
                expect(() =>
                    sigstoreCapability.schemas.input.parse({ operation: 'sign', outputFormat })
                ).not.toThrow();
            }
        });

        it('accepts valid verification output', () => {
            const result = sigstoreCapability.schemas.output.safeParse({
                success: true,
                operation: 'verify',
                verified: true,
                message: 'Signature verification passed',
            });
            expect(result.success).toBe(true);
        });

        it('accepts verification failure output', () => {
            const result = sigstoreCapability.schemas.output.safeParse({
                success: false,
                operation: 'verify',
                verified: false,
                verificationErrors: ['Certificate expired', 'Invalid signature'],
                message: 'Signature verification failed',
            });
            expect(result.success).toBe(true);
        });
    });

    describe('factory function', () => {
        it('builds a Dagger container for signing', () => {
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

            sigstoreCapability.factory(
                fakeDag,
                {
                    ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
                    config: {},
                    secretRefs: {},
                },
                {
                    operation: 'sign',
                    artifactPath: 'dist/artifact.tar.gz',
                }
            );

            expect(calls.from[0]).toContain('cosign');
            expect(calls.env.some((e) => e.key === 'OPERATION' && e.value === 'sign')).toBe(true);
            expect(calls.env.some((e) => e.key === 'COSIGN_EXPERIMENTAL' && e.value === '1')).toBe(true);
        });
    });
});
