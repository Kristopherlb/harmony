/**
 * packages/capabilities/src/utilities/compression.capability.test.ts
 * TCS-001 contract verification for File Compression capability.
 */
import { describe, it, expect } from 'vitest';
import { compressionCapability } from './compression.capability.js';

describe('compressionCapability', () => {
    describe('TCS-001 contract verification', () => {
        it('validates aiHints examples against input schema', () => {
            expect(() =>
                compressionCapability.schemas.input.parse(compressionCapability.aiHints.exampleInput)
            ).not.toThrow();
        });

        it('validates aiHints examples against output schema', () => {
            expect(() =>
                compressionCapability.schemas.output.parse(compressionCapability.aiHints.exampleOutput)
            ).not.toThrow();
        });

        it('has required OCS metadata fields', () => {
            expect(compressionCapability.metadata.id).toBe('golden.utilities.compression');
            expect(compressionCapability.metadata.version).toMatch(/^\d+\.\d+\.\d+$/);
            expect(compressionCapability.metadata.name).toBe('compression');
            expect(compressionCapability.metadata.description).toBeTruthy();
            expect(compressionCapability.metadata.tags).toContain('transformer');
        });

        it('declares pure transformer with no network access', () => {
            expect(compressionCapability.security.networkAccess.allowOutbound).toEqual([]);
        });
    });

    describe('factory - compress operation', () => {
        it('builds a Dagger container for gzip compression', () => {
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

            compressionCapability.factory(
                fakeDag,
                {
                    ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
                    config: {},
                    secretRefs: {},
                },
                {
                    operation: 'compress',
                    format: 'gzip',
                    data: 'SGVsbG8gV29ybGQh',
                    inputEncoding: 'base64',
                }
            );

            expect(calls.from[0]).toContain('node:');
            expect(calls.env.some((e) => e.key === 'OPERATION' && e.value === 'compress')).toBe(true);
            expect(calls.env.some((e) => e.key === 'FORMAT' && e.value === 'gzip')).toBe(true);
            expect(calls.exec.length).toBe(1);
        });
    });

    describe('factory - decompress operation', () => {
        it('builds a Dagger container for decompression', () => {
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

            compressionCapability.factory(
                fakeDag,
                {
                    ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
                    config: {},
                    secretRefs: {},
                },
                {
                    operation: 'decompress',
                    format: 'gzip',
                    data: 'H4sIAAAAAAAAA8tIzcnJVyjPL8pJUQQAlRmFGwwAAAA=',
                    inputEncoding: 'base64',
                }
            );

            const operation = calls.env.find((e) => e.key === 'OPERATION');
            expect(operation?.value).toBe('decompress');
        });
    });

    describe('schema validation', () => {
        it('accepts all supported formats', () => {
            const formats = ['gzip', 'deflate', 'brotli', 'zstd'];

            for (const format of formats) {
                expect(() =>
                    compressionCapability.schemas.input.parse({
                        operation: 'compress',
                        format,
                        data: 'test',
                    })
                ).not.toThrow();
            }
        });

        it('accepts compression level option', () => {
            expect(() =>
                compressionCapability.schemas.input.parse({
                    operation: 'compress',
                    format: 'gzip',
                    data: 'test',
                    level: 9,
                })
            ).not.toThrow();
        });

        it('rejects invalid compression level', () => {
            expect(() =>
                compressionCapability.schemas.input.parse({
                    operation: 'compress',
                    format: 'gzip',
                    data: 'test',
                    level: 15, // Out of range
                })
            ).toThrow();
        });

        it('rejects invalid operation', () => {
            expect(() =>
                compressionCapability.schemas.input.parse({
                    operation: 'invalid',
                    format: 'gzip',
                    data: 'test',
                })
            ).toThrow();
        });
    });
});
