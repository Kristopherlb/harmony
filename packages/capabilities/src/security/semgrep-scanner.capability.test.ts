/**
 * packages/capabilities/src/security/semgrep-scanner.capability.test.ts
 * TCS-001 contract verification for Semgrep Scanner capability.
 */
import { describe, it, expect } from 'vitest';
import { semgrepScannerCapability } from './semgrep-scanner.capability.js';

describe('semgrepScannerCapability', () => {
    describe('TCS-001 contract verification', () => {
        it('validates aiHints examples against input schema', () => {
            expect(() =>
                semgrepScannerCapability.schemas.input.parse(semgrepScannerCapability.aiHints.exampleInput)
            ).not.toThrow();
        });

        it('validates aiHints examples against output schema', () => {
            expect(() =>
                semgrepScannerCapability.schemas.output.parse(semgrepScannerCapability.aiHints.exampleOutput)
            ).not.toThrow();
        });

        it('has required OCS metadata fields', () => {
            expect(semgrepScannerCapability.metadata.id).toBe('golden.security.semgrep-scanner');
            expect(semgrepScannerCapability.metadata.version).toMatch(/^\d+\.\d+\.\d+$/);
            expect(semgrepScannerCapability.metadata.name).toBe('semgrepScanner');
            expect(semgrepScannerCapability.metadata.description).toBeTruthy();
            expect(semgrepScannerCapability.metadata.tags).toContain('commander');
            expect(semgrepScannerCapability.metadata.tags).toContain('security');
        });
    });

    describe('factory', () => {
        it('builds a Dagger container for code scanning', () => {
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

            semgrepScannerCapability.factory(
                fakeDag,
                {
                    ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
                    config: {},
                    secretRefs: {},
                },
                {
                    target: '/app/src',
                    config: 'p/security-audit',
                }
            );

            expect(calls.from[0]).toContain('semgrep');
            expect(calls.env.some((e) => e.key === 'TARGET')).toBe(true);
            expect(calls.env.some((e) => e.key === 'SEMGREP_CONFIG')).toBe(true);
            expect(calls.exec.length).toBe(1);
        });

        it('supports custom rules', () => {
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

            semgrepScannerCapability.factory(
                fakeDag,
                {
                    ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
                    config: {},
                    secretRefs: {},
                },
                {
                    target: '/app',
                    config: 'p/owasp-top-ten',
                    severity: ['ERROR', 'WARNING'],
                }
            );

            const config = calls.env.find((e) => e.key === 'SEMGREP_CONFIG');
            expect(config?.value).toBe('p/owasp-top-ten');
        });
    });

    describe('schema validation', () => {
        it('accepts registry configs', () => {
            const configs = ['p/security-audit', 'p/owasp-top-ten', 'p/typescript', 'p/python'];

            for (const config of configs) {
                expect(() =>
                    semgrepScannerCapability.schemas.input.parse({
                        target: '/app',
                        config,
                    })
                ).not.toThrow();
            }
        });

        it('accepts severity filter', () => {
            expect(() =>
                semgrepScannerCapability.schemas.input.parse({
                    target: '/app',
                    config: 'auto',
                    severity: ['ERROR'],
                })
            ).not.toThrow();
        });

        it('accepts exclude patterns', () => {
            expect(() =>
                semgrepScannerCapability.schemas.input.parse({
                    target: '/app',
                    config: 'auto',
                    exclude: ['node_modules', 'dist', '*.test.ts'],
                })
            ).not.toThrow();
        });
    });
});
