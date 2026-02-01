/**
 * packages/capabilities/src/security/gitleaks.capability.test.ts
 * TCS-001 contract verification for Gitleaks capability.
 */
import { describe, it, expect } from 'vitest';
import { gitleaksCapability } from './gitleaks.capability.js';

describe('gitleaksCapability', () => {
    describe('TCS-001 contract verification', () => {
        it('validates aiHints examples against input schema', () => {
            expect(() =>
                gitleaksCapability.schemas.input.parse(gitleaksCapability.aiHints.exampleInput)
            ).not.toThrow();
        });

        it('validates aiHints examples against output schema', () => {
            expect(() =>
                gitleaksCapability.schemas.output.parse(gitleaksCapability.aiHints.exampleOutput)
            ).not.toThrow();
        });

        it('has required OCS metadata fields', () => {
            expect(gitleaksCapability.metadata.id).toBe('golden.security.gitleaks');
            expect(gitleaksCapability.metadata.version).toMatch(/^\d+\.\d+\.\d+$/);
            expect(gitleaksCapability.metadata.name).toBe('gitleaks');
            expect(gitleaksCapability.metadata.description).toBeTruthy();
            expect(gitleaksCapability.metadata.tags).toContain('security');
        });

        it('declares no network access (runs locally)', () => {
            expect(gitleaksCapability.security.networkAccess.allowOutbound).toEqual([]);
        });
    });

    describe('factory - detect mode', () => {
        it('builds a Dagger container for secret detection', () => {
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

            gitleaksCapability.factory(
                fakeDag,
                {
                    ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
                    config: {},
                    secretRefs: {},
                },
                {
                    operation: 'detect',
                    source: '/path/to/repo',
                }
            );

            expect(calls.from[0]).toContain('gitleaks');
            expect(calls.env.some((e) => e.key === 'OPERATION' && e.value === 'detect')).toBe(true);
            expect(calls.env.some((e) => e.key === 'SOURCE' && e.value === '/path/to/repo')).toBe(true);
        });
    });

    describe('factory - protect mode', () => {
        it('builds a Dagger container for pre-commit scanning', () => {
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

            gitleaksCapability.factory(
                fakeDag,
                {
                    ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
                    config: {},
                    secretRefs: {},
                },
                {
                    operation: 'protect',
                    source: '/path/to/repo',
                    redact: true,
                }
            );

            expect(calls.env.some((e) => e.key === 'OPERATION' && e.value === 'protect')).toBe(true);
        });
    });

    describe('schema validation', () => {
        it('accepts valid finding schema', () => {
            const finding = {
                description: 'AWS Access Key',
                file: 'config.js',
                startLine: 42,
                endLine: 42,
                match: 'AKIA***',
                secret: 'AKIA***',
                rule: 'aws-access-key',
            };

            const result = gitleaksCapability.schemas.output.safeParse({
                findings: [finding],
                findingsCount: 1,
                exitCode: 1,
                scanDuration: 1000,
            });
            expect(result.success).toBe(true);
        });

        it('accepts all operations', () => {
            const operations = ['detect', 'protect'];

            for (const operation of operations) {
                expect(() =>
                    gitleaksCapability.schemas.input.parse({ operation, source: '/path' })
                ).not.toThrow();
            }
        });
    });
});
