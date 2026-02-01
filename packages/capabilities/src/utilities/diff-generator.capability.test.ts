/**
 * packages/capabilities/src/utilities/diff-generator.capability.test.ts
 * TCS-001 contract verification for Diff Generator capability.
 */
import { describe, it, expect } from 'vitest';
import { diffGeneratorCapability } from './diff-generator.capability.js';

describe('diffGeneratorCapability', () => {
    describe('TCS-001 contract verification', () => {
        it('validates aiHints examples against input schema', () => {
            expect(() =>
                diffGeneratorCapability.schemas.input.parse(diffGeneratorCapability.aiHints.exampleInput)
            ).not.toThrow();
        });

        it('validates aiHints examples against output schema', () => {
            expect(() =>
                diffGeneratorCapability.schemas.output.parse(diffGeneratorCapability.aiHints.exampleOutput)
            ).not.toThrow();
        });

        it('has required OCS metadata fields', () => {
            expect(diffGeneratorCapability.metadata.id).toBe('golden.utilities.diff-generator');
            expect(diffGeneratorCapability.metadata.version).toMatch(/^\d+\.\d+\.\d+$/);
            expect(diffGeneratorCapability.metadata.name).toBe('diffGenerator');
<<<<<<< ours
            expect(diffGeneratorCapability.metadata.description).toBeTruthy();
            expect(diffGeneratorCapability.metadata.tags).toContain('utility');
            expect(diffGeneratorCapability.metadata.tags).toContain('diff');
        });
    });

    describe('factory - string comparison', () => {
        it('builds a Dagger container for string diff', () => {
            const calls: { env: Array<{ key: string; value: string }>; exec: string[][]; from: string[] } = {
                env: [],
                exec: [],
=======
            expect(diffGeneratorCapability.metadata.tags).toContain('diff');
            expect(diffGeneratorCapability.metadata.tags).toContain('patch');
        });
    });

    describe('schema validation', () => {
        it('accepts all operations', () => {
            const operations = ['diff', 'apply-patch', 'reverse-patch', 'stat'];
            for (const operation of operations) {
                expect(() =>
                    diffGeneratorCapability.schemas.input.parse({ operation })
                ).not.toThrow();
            }
        });

        it('accepts all formats', () => {
            const formats = ['unified', 'context', 'json', 'html'];
            for (const format of formats) {
                expect(() =>
                    diffGeneratorCapability.schemas.input.parse({ operation: 'diff', format })
                ).not.toThrow();
            }
        });

        it('accepts diff with options', () => {
            const result = diffGeneratorCapability.schemas.input.safeParse({
                operation: 'diff',
                originalContent: 'line1\nline2',
                modifiedContent: 'line1\nline2\nline3',
                contextLines: 5,
                ignoreWhitespace: true,
            });
            expect(result.success).toBe(true);
        });

        it('accepts output with stats', () => {
            const result = diffGeneratorCapability.schemas.output.safeParse({
                success: true,
                operation: 'stat',
                stats: {
                    linesAdded: 10,
                    linesRemoved: 5,
                    hunks: 3,
                    files: 2,
                },
                message: 'Stats calculated',
            });
            expect(result.success).toBe(true);
        });
    });

    describe('factory function', () => {
        it('builds a Dagger container for diff', () => {
            const calls: { env: Array<{ key: string; value: string }>; from: string[] } = {
                env: [],
>>>>>>> theirs
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
<<<<<<< ours
                        withExec(args: string[]) {
                            calls.exec.push(args);
=======
                        withExec() {
>>>>>>> theirs
                            return builder;
                        },
                    };
                    return builder;
                },
            };

            diffGeneratorCapability.factory(
                fakeDag,
                {
                    ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
                    config: {},
                    secretRefs: {},
                },
                {
<<<<<<< ours
                    original: 'Line 1\nLine 2',
                    modified: 'Line 1\nLine 3',
                    format: 'unified',
=======
                    operation: 'diff',
                    originalContent: 'a',
                    modifiedContent: 'b',
>>>>>>> theirs
                }
            );

            expect(calls.from[0]).toContain('alpine');
<<<<<<< ours
            expect(calls.env.some((e) => e.key === 'FORMAT' && e.value === 'unified')).toBe(true);
            expect(calls.env.some((e) => e.key === 'ORIGINAL')).toBe(true);
            expect(calls.env.some((e) => e.key === 'MODIFIED')).toBe(true);
            expect(calls.exec.length).toBe(1);
        });
    });

    describe('factory - file comparison with options', () => {
        it('builds a Dagger container with file paths and options', () => {
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

            diffGeneratorCapability.factory(
                fakeDag,
                {
                    ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
                    config: {},
                    secretRefs: {},
                },
                {
                    originalPath: '/path/to/original.txt',
                    modifiedPath: '/path/to/modified.txt',
                    ignoreWhitespace: true,
                    ignoreCase: true,
                    context: 5,
                }
            );

            expect(calls.env.some((e) => e.key === 'ORIGINAL_PATH')).toBe(true);
            expect(calls.env.some((e) => e.key === 'MODIFIED_PATH')).toBe(true);
            expect(calls.env.some((e) => e.key === 'IGNORE_WHITESPACE' && e.value === 'true')).toBe(true);
            expect(calls.env.some((e) => e.key === 'IGNORE_CASE' && e.value === 'true')).toBe(true);
            expect(calls.env.some((e) => e.key === 'CONTEXT_LINES' && e.value === '5')).toBe(true);
        });
    });

    describe('schema validation', () => {
        it('accepts all formats', () => {
            const formats = ['unified', 'side-by-side', 'json', 'html'];

            for (const format of formats) {
                expect(() =>
                    diffGeneratorCapability.schemas.input.parse({
                        original: 'a',
                        modified: 'b',
                        format,
                    })
                ).not.toThrow();
            }
        });

        it('rejects invalid format', () => {
            expect(() =>
                diffGeneratorCapability.schemas.input.parse({
                    original: 'a',
                    modified: 'b',
                    format: 'invalid',
                })
            ).toThrow();
        });

        it('validates output with identical files', () => {
            expect(() =>
                diffGeneratorCapability.schemas.output.parse({
                    success: true,
                    diff: '',
                    format: 'unified',
                    linesAdded: 0,
                    linesRemoved: 0,
                    linesChanged: 0,
                    identical: true,
                    message: 'Files are identical',
                })
            ).not.toThrow();
        });

        it('validates output with structured hunks', () => {
            expect(() =>
                diffGeneratorCapability.schemas.output.parse({
                    success: true,
                    diff: '',
                    format: 'json',
                    hunks: [
                        {
                            originalStart: 1,
                            originalCount: 3,
                            modifiedStart: 1,
                            modifiedCount: 4,
                            changes: [
                                { type: 'remove', lineOriginal: 1, content: 'old' },
                                { type: 'add', lineModified: 1, content: 'new' },
                            ],
                        },
                    ],
                    linesAdded: 1,
                    linesRemoved: 1,
                    linesChanged: 2,
                    identical: false,
                    message: 'Generated diff',
                })
            ).not.toThrow();
=======
            expect(calls.env.some((e) => e.key === 'OPERATION' && e.value === 'diff')).toBe(true);
>>>>>>> theirs
        });
    });
});
