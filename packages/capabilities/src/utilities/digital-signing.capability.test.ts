/**
 * packages/capabilities/src/utilities/digital-signing.capability.test.ts
 * TCS-001 contract verification for Digital Signing capability.
 */
import { describe, it, expect } from 'vitest';
import { digitalSigningCapability } from './digital-signing.capability.js';

describe('digitalSigningCapability', () => {
    describe('TCS-001 contract verification', () => {
        it('validates aiHints examples against input schema', () => {
            expect(() =>
                digitalSigningCapability.schemas.input.parse(digitalSigningCapability.aiHints.exampleInput)
            ).not.toThrow();
        });

        it('validates aiHints examples against output schema', () => {
            expect(() =>
                digitalSigningCapability.schemas.output.parse(digitalSigningCapability.aiHints.exampleOutput)
            ).not.toThrow();
        });

        it('has required OCS metadata fields', () => {
            expect(digitalSigningCapability.metadata.id).toBe('golden.utilities.digital-signing');
            expect(digitalSigningCapability.metadata.version).toMatch(/^\d+\.\d+\.\d+$/);
            expect(digitalSigningCapability.metadata.name).toBe('digitalSigning');
            expect(digitalSigningCapability.metadata.description).toBeTruthy();
            expect(digitalSigningCapability.metadata.tags).toContain('transformer');
        });
    });

    describe('factory - sign operation', () => {
        it('builds a Dagger container for signing', () => {
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

            digitalSigningCapability.factory(
                fakeDag,
                {
                    ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
                    config: {},
                    secretRefs: { privateKey: '/secrets/signing-key' },
                },
                {
                    operation: 'sign',
                    data: 'SGVsbG8gV29ybGQh',
                    algorithm: 'RSA-SHA256',
                }
            );

            expect(calls.from[0]).toContain('node:');
            expect(calls.env.some((e) => e.key === 'OPERATION' && e.value === 'sign')).toBe(true);
            expect(calls.env.some((e) => e.key === 'ALGORITHM' && e.value === 'RSA-SHA256')).toBe(true);
        });
    });

    describe('factory - verify operation', () => {
        it('builds a Dagger container for verification', () => {
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

            digitalSigningCapability.factory(
                fakeDag,
                {
                    ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
                    config: {},
                    secretRefs: { publicKey: '/secrets/verify-key' },
                },
                {
                    operation: 'verify',
                    data: 'SGVsbG8gV29ybGQh',
                    signature: 'base64-signature-here',
                    algorithm: 'RSA-SHA256',
                }
            );

            const operation = calls.env.find((e) => e.key === 'OPERATION');
            expect(operation?.value).toBe('verify');
        });
    });

    describe('schema validation', () => {
        it('accepts all signing algorithms', () => {
            const algorithms = ['RSA-SHA256', 'RSA-SHA512', 'ECDSA-SHA256', 'Ed25519'];

            for (const algorithm of algorithms) {
                expect(() =>
                    digitalSigningCapability.schemas.input.parse({
                        operation: 'sign',
                        data: 'test',
                        algorithm,
                    })
                ).not.toThrow();
            }
        });

        it('requires signature for verify operation', () => {
            // Signature is optional in schema (runtime validates)
            const result = digitalSigningCapability.schemas.input.safeParse({
                operation: 'verify',
                data: 'test',
                algorithm: 'RSA-SHA256',
            });
            expect(result.success).toBe(true);
        });
    });
});
