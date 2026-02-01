/**
 * packages/capabilities/src/auth/jwt-utilities.capability.test.ts
 * TCS-001 contract verification for JWT Utilities capability.
 */
import { describe, it, expect } from 'vitest';
import { jwtUtilitiesCapability } from './jwt-utilities.capability.js';

describe('jwtUtilitiesCapability', () => {
    describe('TCS-001 contract verification', () => {
        it('validates aiHints examples against input schema', () => {
            expect(() =>
                jwtUtilitiesCapability.schemas.input.parse(jwtUtilitiesCapability.aiHints.exampleInput)
            ).not.toThrow();
        });

        it('validates aiHints examples against output schema', () => {
            expect(() =>
                jwtUtilitiesCapability.schemas.output.parse(jwtUtilitiesCapability.aiHints.exampleOutput)
            ).not.toThrow();
        });

        it('has required OCS metadata fields', () => {
            expect(jwtUtilitiesCapability.metadata.id).toBe('golden.auth.jwt-utilities');
            expect(jwtUtilitiesCapability.metadata.version).toMatch(/^\d+\.\d+\.\d+$/);
            expect(jwtUtilitiesCapability.metadata.name).toBe('jwtUtilities');
            expect(jwtUtilitiesCapability.metadata.description).toBeTruthy();
            expect(jwtUtilitiesCapability.metadata.tags).toContain('transformer');
            expect(jwtUtilitiesCapability.metadata.tags).toContain('auth');
        });

        it('has required security configuration', () => {
            expect(jwtUtilitiesCapability.security.dataClassification).toBe('CONFIDENTIAL');
        });

        it('declares pure transformer (no network access needed for decode)', () => {
            // Transformers should have minimal or empty network requirements
            expect(jwtUtilitiesCapability.security.networkAccess).toBeDefined();
        });
    });

    describe('factory - decode operation', () => {
        it('builds a Dagger container for JWT decoding', () => {
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

            jwtUtilitiesCapability.factory(
                fakeDag,
                {
                    ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
                    config: {},
                    secretRefs: {},
                },
                {
                    operation: 'decode',
                    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U',
                }
            );

            expect(calls.from[0]).toContain('node:');
            expect(calls.env.some((e) => e.key === 'INPUT_JSON')).toBe(true);
            expect(calls.env.some((e) => e.key === 'OPERATION' && e.value === 'decode')).toBe(true);
            expect(calls.exec.length).toBe(1);
        });
    });

    describe('factory - verify operation', () => {
        it('builds a Dagger container for JWT verification', () => {
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

            jwtUtilitiesCapability.factory(
                fakeDag,
                {
                    ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
                    config: {},
                    secretRefs: { signingKey: '/secrets/jwt/signing_key' },
                },
                {
                    operation: 'verify',
                    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U',
                    algorithm: 'HS256',
                }
            );

            const operation = calls.env.find((e) => e.key === 'OPERATION');
            expect(operation?.value).toBe('verify');
        });
    });

    describe('factory - sign operation', () => {
        it('builds a Dagger container for JWT signing', () => {
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

            jwtUtilitiesCapability.factory(
                fakeDag,
                {
                    ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
                    config: {},
                    secretRefs: { signingKey: '/secrets/jwt/signing_key' },
                },
                {
                    operation: 'sign',
                    payload: { sub: '1234567890', name: 'John Doe', iat: 1516239022 },
                    algorithm: 'HS256',
                    expiresIn: 3600,
                }
            );

            const operation = calls.env.find((e) => e.key === 'OPERATION');
            expect(operation?.value).toBe('sign');
        });
    });

    describe('schema validation', () => {
        it('accepts valid decode operation', () => {
            expect(() =>
                jwtUtilitiesCapability.schemas.input.parse({
                    operation: 'decode',
                    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U',
                })
            ).not.toThrow();
        });

        it('accepts valid sign operation', () => {
            expect(() =>
                jwtUtilitiesCapability.schemas.input.parse({
                    operation: 'sign',
                    payload: { sub: 'user123' },
                    algorithm: 'RS256',
                })
            ).not.toThrow();
        });

        it('accepts valid verify operation', () => {
            expect(() =>
                jwtUtilitiesCapability.schemas.input.parse({
                    operation: 'verify',
                    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U',
                    algorithm: 'HS256',
                })
            ).not.toThrow();
        });

        it('rejects invalid operation', () => {
            expect(() =>
                jwtUtilitiesCapability.schemas.input.parse({
                    operation: 'invalid',
                    token: 'abc',
                })
            ).toThrow();
        });

        it('rejects invalid algorithm', () => {
            expect(() =>
                jwtUtilitiesCapability.schemas.input.parse({
                    operation: 'sign',
                    payload: { sub: 'user123' },
                    algorithm: 'INVALID',
                })
            ).toThrow();
        });
    });
});
