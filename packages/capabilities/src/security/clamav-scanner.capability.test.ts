/**
 * packages/capabilities/src/security/clamav-scanner.capability.test.ts
 * TCS-001 contract verification for ClamAV Scanner capability.
 */
import { describe, it, expect } from 'vitest';
import { clamavScannerCapability } from './clamav-scanner.capability.js';

describe('clamavScannerCapability', () => {
    describe('TCS-001 contract verification', () => {
        it('validates aiHints examples against input schema', () => {
            expect(() =>
                clamavScannerCapability.schemas.input.parse(clamavScannerCapability.aiHints.exampleInput)
            ).not.toThrow();
        });

        it('validates aiHints examples against output schema', () => {
            expect(() =>
                clamavScannerCapability.schemas.output.parse(clamavScannerCapability.aiHints.exampleOutput)
            ).not.toThrow();
        });

        it('has required OCS metadata fields', () => {
            expect(clamavScannerCapability.metadata.id).toBe('golden.security.clamav-scanner');
            expect(clamavScannerCapability.metadata.version).toMatch(/^\d+\.\d+\.\d+$/);
            expect(clamavScannerCapability.metadata.name).toBe('clamavScanner');
            expect(clamavScannerCapability.metadata.description).toBeTruthy();
            expect(clamavScannerCapability.metadata.tags).toContain('commander');
            expect(clamavScannerCapability.metadata.tags).toContain('security');
        });

        it('declares network access for signature updates', () => {
            expect(clamavScannerCapability.security.networkAccess.allowOutbound).toBeDefined();
            expect(clamavScannerCapability.security.networkAccess.allowOutbound.length).toBeGreaterThan(0);
        });
    });

    describe('factory', () => {
        it('builds a Dagger container with ClamAV', () => {
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

            clamavScannerCapability.factory(
                fakeDag,
                {
                    ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
                    config: {},
                    secretRefs: {},
                },
                {
                    scanType: 'data',
                    data: 'SGVsbG8gV29ybGQh',
                    dataEncoding: 'base64',
                }
            );

            expect(calls.from[0]).toContain('clamav');
            expect(calls.env.some((e) => e.key === 'SCAN_TYPE' && e.value === 'data')).toBe(true);
            expect(calls.exec.length).toBe(1);
        });

        it('supports file path scanning', () => {
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

            clamavScannerCapability.factory(
                fakeDag,
                {
                    ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
                    config: {},
                    secretRefs: {},
                },
                {
                    scanType: 'path',
                    path: '/app/uploads',
                    recursive: true,
                }
            );

            const scanType = calls.env.find((e) => e.key === 'SCAN_TYPE');
            expect(scanType?.value).toBe('path');
        });
    });

    describe('schema validation', () => {
        it('accepts data scan with base64 encoding', () => {
            expect(() =>
                clamavScannerCapability.schemas.input.parse({
                    scanType: 'data',
                    data: 'SGVsbG8gV29ybGQh',
                    dataEncoding: 'base64',
                })
            ).not.toThrow();
        });

        it('accepts path scan with recursive option', () => {
            expect(() =>
                clamavScannerCapability.schemas.input.parse({
                    scanType: 'path',
                    path: '/var/uploads',
                    recursive: true,
                })
            ).not.toThrow();
        });

        it('rejects invalid scan type', () => {
            expect(() =>
                clamavScannerCapability.schemas.input.parse({
                    scanType: 'invalid',
                    data: 'test',
                })
            ).toThrow();
        });
    });
});
