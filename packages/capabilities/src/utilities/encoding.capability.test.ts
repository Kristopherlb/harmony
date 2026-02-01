/**
 * packages/capabilities/src/utilities/encoding.capability.test.ts
 * TCS-001 contract verification for Encoding capability.
 */
import { describe, it, expect } from 'vitest';
import { encodingCapability } from './encoding.capability.js';

describe('encodingCapability', () => {
    describe('TCS-001 contract verification', () => {
        it('validates aiHints examples against input schema', () => {
            expect(() =>
                encodingCapability.schemas.input.parse(encodingCapability.aiHints.exampleInput)
            ).not.toThrow();
        });

        it('validates aiHints examples against output schema', () => {
            expect(() =>
                encodingCapability.schemas.output.parse(encodingCapability.aiHints.exampleOutput)
            ).not.toThrow();
        });

        it('has required OCS metadata fields', () => {
            expect(encodingCapability.metadata.id).toBe('golden.utilities.encoding');
            expect(encodingCapability.metadata.version).toMatch(/^\d+\.\d+\.\d+$/);
            expect(encodingCapability.metadata.name).toBe('encoding');
            expect(encodingCapability.metadata.description).toBeTruthy();
            expect(encodingCapability.metadata.tags).toContain('transformer');
        });

        it('declares no network access for pure transformer', () => {
            expect(encodingCapability.security.networkAccess.allowOutbound).toEqual([]);
        });
    });

    describe('factory - base64 encoding', () => {
        it('builds a Dagger container for base64 encoding', () => {
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

            encodingCapability.factory(
                fakeDag,
                {
                    ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
                    config: {},
                    secretRefs: {},
                },
                {
                    operation: 'base64Encode',
                    data: 'Hello, World!',
                }
            );

            expect(calls.from[0]).toContain('node:');
            expect(calls.env.some((e) => e.key === 'OPERATION' && e.value === 'base64Encode')).toBe(true);
            expect(calls.env.some((e) => e.key === 'INPUT_JSON')).toBe(true);
        });
    });

    describe('factory - hex encoding', () => {
        it('builds a Dagger container for hex encoding', () => {
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

            encodingCapability.factory(
                fakeDag,
                {
                    ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
                    config: {},
                    secretRefs: {},
                },
                {
                    operation: 'hexEncode',
                    data: 'test',
                }
            );

            expect(calls.env.some((e) => e.key === 'OPERATION' && e.value === 'hexEncode')).toBe(true);
        });
    });

    describe('schema validation', () => {
        it('accepts all encoding operations', () => {
            const operations = [
                'base64Encode',
                'base64Decode',
                'hexEncode',
                'hexDecode',
                'urlEncode',
                'urlDecode',
                'htmlEncode',
                'htmlDecode',
            ];

            for (const operation of operations) {
                expect(() =>
                    encodingCapability.schemas.input.parse({ operation, data: 'test' })
                ).not.toThrow();
            }
        });

        it('accepts urlSafe option for base64', () => {
            const result = encodingCapability.schemas.input.safeParse({
                operation: 'base64Encode',
                data: 'test',
                urlSafe: true,
            });
            expect(result.success).toBe(true);
        });
    });
});
