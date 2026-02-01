/**
 * packages/capabilities/src/utilities/hashing.capability.test.ts
 * TCS-001 contract verification for Hashing capability.
 */
import { describe, it, expect } from 'vitest';
import { hashingCapability } from './hashing.capability.js';

describe('hashingCapability', () => {
    describe('TCS-001 contract verification', () => {
        it('validates aiHints examples against input schema', () => {
            expect(() =>
                hashingCapability.schemas.input.parse(hashingCapability.aiHints.exampleInput)
            ).not.toThrow();
        });

        it('validates aiHints examples against output schema', () => {
            expect(() =>
                hashingCapability.schemas.output.parse(hashingCapability.aiHints.exampleOutput)
            ).not.toThrow();
        });

        it('has required OCS metadata fields', () => {
            expect(hashingCapability.metadata.id).toBe('golden.utilities.hashing');
            expect(hashingCapability.metadata.version).toMatch(/^\d+\.\d+\.\d+$/);
            expect(hashingCapability.metadata.name).toBe('hashing');
            expect(hashingCapability.metadata.description).toBeTruthy();
            expect(hashingCapability.metadata.tags).toContain('transformer');
            expect(hashingCapability.metadata.tags).toContain('crypto');
        });

        it('declares pure transformer with no network access', () => {
            expect(hashingCapability.security.networkAccess.allowOutbound).toEqual([]);
        });

        it('is idempotent (same input always produces same output)', () => {
            expect(hashingCapability.operations.isIdempotent).toBe(true);
        });
    });

    describe('factory', () => {
        it('builds a Dagger container for SHA-256 hashing', () => {
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

            hashingCapability.factory(
                fakeDag,
                {
                    ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
                    config: {},
                    secretRefs: {},
                },
                {
                    algorithm: 'sha256',
                    data: 'Hello, World!',
                }
            );

            expect(calls.from[0]).toContain('node:');
            expect(calls.env.some((e) => e.key === 'INPUT_JSON')).toBe(true);
            expect(calls.env.some((e) => e.key === 'ALGORITHM' && e.value === 'sha256')).toBe(true);
            expect(calls.exec.length).toBe(1);
        });

        it('supports all documented algorithms', () => {
            const algorithms = ['md5', 'sha1', 'sha256', 'sha384', 'sha512', 'sha3-256', 'sha3-512', 'blake2b512', 'blake2s256'];

            for (const algorithm of algorithms) {
                expect(() =>
                    hashingCapability.schemas.input.parse({
                        algorithm,
                        data: 'test',
                    })
                ).not.toThrow();
            }
        });
    });

    describe('schema validation', () => {
        it('accepts string data input', () => {
            expect(() =>
                hashingCapability.schemas.input.parse({
                    algorithm: 'sha256',
                    data: 'test string',
                })
            ).not.toThrow();
        });

        it('accepts base64 encoded data', () => {
            expect(() =>
                hashingCapability.schemas.input.parse({
                    algorithm: 'sha256',
                    data: 'SGVsbG8gV29ybGQ=',
                    inputEncoding: 'base64',
                })
            ).not.toThrow();
        });

        it('supports hex and base64 output encodings', () => {
            expect(() =>
                hashingCapability.schemas.input.parse({
                    algorithm: 'sha256',
                    data: 'test',
                    outputEncoding: 'hex',
                })
            ).not.toThrow();

            expect(() =>
                hashingCapability.schemas.input.parse({
                    algorithm: 'sha256',
                    data: 'test',
                    outputEncoding: 'base64',
                })
            ).not.toThrow();
        });

        it('rejects invalid algorithm', () => {
            expect(() =>
                hashingCapability.schemas.input.parse({
                    algorithm: 'invalid-algo',
                    data: 'test',
                })
            ).toThrow();
        });
    });
});
