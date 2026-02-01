/**
 * packages/capabilities/src/security/trivy-scanner.capability.test.ts
 * TCS-001 contract verification for Trivy Scanner capability.
 */
import { describe, it, expect } from 'vitest';
import { trivyScannerCapability } from './trivy-scanner.capability.js';

describe('trivyScannerCapability', () => {
    describe('TCS-001 contract verification', () => {
        it('validates aiHints examples against input schema', () => {
            expect(() =>
                trivyScannerCapability.schemas.input.parse(trivyScannerCapability.aiHints.exampleInput)
            ).not.toThrow();
        });

        it('validates aiHints examples against output schema', () => {
            expect(() =>
                trivyScannerCapability.schemas.output.parse(trivyScannerCapability.aiHints.exampleOutput)
            ).not.toThrow();
        });

        it('has required OCS metadata fields', () => {
            expect(trivyScannerCapability.metadata.id).toBe('golden.security.trivy-scanner');
            expect(trivyScannerCapability.metadata.version).toMatch(/^\d+\.\d+\.\d+$/);
            expect(trivyScannerCapability.metadata.name).toBe('trivyScanner');
            expect(trivyScannerCapability.metadata.description).toBeTruthy();
            expect(trivyScannerCapability.metadata.tags).toContain('commander');
            expect(trivyScannerCapability.metadata.tags).toContain('security');
        });

        it('declares network access for vulnerability database', () => {
            expect(trivyScannerCapability.security.networkAccess.allowOutbound).toBeDefined();
        });
    });

    describe('factory - container image scan', () => {
        it('builds a Dagger container for image scanning', () => {
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

            trivyScannerCapability.factory(
                fakeDag,
                {
                    ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
                    config: {},
                    secretRefs: {},
                },
                {
                    target: 'alpine:3.18',
                    scanType: 'image',
                }
            );

            expect(calls.from[0]).toContain('trivy');
            expect(calls.env.some((e) => e.key === 'SCAN_TYPE' && e.value === 'image')).toBe(true);
            expect(calls.env.some((e) => e.key === 'TARGET' && e.value === 'alpine:3.18')).toBe(true);
            expect(calls.exec.length).toBe(1);
        });
    });

    describe('factory - filesystem scan', () => {
        it('builds a Dagger container for filesystem scanning', () => {
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

            trivyScannerCapability.factory(
                fakeDag,
                {
                    ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
                    config: {},
                    secretRefs: {},
                },
                {
                    target: '/app',
                    scanType: 'filesystem',
                }
            );

            const scanType = calls.env.find((e) => e.key === 'SCAN_TYPE');
            expect(scanType?.value).toBe('filesystem');
        });
    });

    describe('schema validation', () => {
        it('accepts all scan types', () => {
            const scanTypes = ['image', 'filesystem', 'repository', 'config', 'sbom'];

            for (const scanType of scanTypes) {
                expect(() =>
                    trivyScannerCapability.schemas.input.parse({
                        target: 'test-target',
                        scanType,
                    })
                ).not.toThrow();
            }
        });

        it('accepts severity filter', () => {
            expect(() =>
                trivyScannerCapability.schemas.input.parse({
                    target: 'alpine:3.18',
                    scanType: 'image',
                    severities: ['CRITICAL', 'HIGH'],
                })
            ).not.toThrow();
        });

        it('rejects invalid scan type', () => {
            expect(() =>
                trivyScannerCapability.schemas.input.parse({
                    target: 'test',
                    scanType: 'invalid',
                })
            ).toThrow();
        });
    });
});
