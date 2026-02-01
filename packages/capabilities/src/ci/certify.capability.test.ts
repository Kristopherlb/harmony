/**
 * packages/capabilities/src/ci/certify.capability.test.ts
 * TCS-001 contract verification for Certification capability.
 */
import { describe, it, expect } from 'vitest';
import { certifyCapability } from './certify.capability.js';

describe('certifyCapability', () => {
    describe('TCS-001 contract verification', () => {
        it('validates aiHints examples against input schema', () => {
            expect(() =>
                certifyCapability.schemas.input.parse(certifyCapability.aiHints.exampleInput)
            ).not.toThrow();
        });

        it('validates aiHints examples against output schema', () => {
            expect(() =>
                certifyCapability.schemas.output.parse(certifyCapability.aiHints.exampleOutput)
            ).not.toThrow();
        });

        it('has required OCS metadata fields', () => {
            expect(certifyCapability.metadata.id).toBe('golden.ci.certify');
            expect(certifyCapability.metadata.version).toMatch(/^\d+\.\d+\.\d+$/);
            expect(certifyCapability.metadata.name).toBe('certify');
            expect(certifyCapability.metadata.description).toBeTruthy();
            expect(certifyCapability.metadata.tags).toContain('ci');
            expect(certifyCapability.metadata.tags).toContain('compliance');
        });

        it('declares no network access (runs locally)', () => {
            expect(certifyCapability.security.networkAccess.allowOutbound).toEqual([]);
        });

        it('requires ci:audit scope', () => {
            expect(certifyCapability.security.requiredScopes).toContain('ci:audit');
        });

        it('declares OSCAL control IDs', () => {
            expect(certifyCapability.security.oscalControlIds).toContain('AU-2');
            expect(certifyCapability.security.oscalControlIds).toContain('CM-3');
        });
    });

    describe('factory - full audit', () => {
        it('builds a Dagger container for certification', () => {
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

            certifyCapability.factory(
                fakeDag,
                {
                    ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
                    config: {},
                    secretRefs: {},
                },
                {
                    operation: 'full',
                    gitSha: 'abc123',
                }
            );

            expect(calls.from[0]).toContain('node');
            expect(calls.env.some((e) => e.key === 'OPERATION' && e.value === 'full')).toBe(true);
        });
    });

    describe('schema validation', () => {
        it('accepts all operations', () => {
            const operations = ['full', 'naming', 'versioning', 'ocs', 'wcs', 'observability', 'secrets'];

            for (const operation of operations) {
                expect(() =>
                    certifyCapability.schemas.input.parse({ operation })
                ).not.toThrow();
            }
        });

        it('accepts valid audit result', () => {
            const result = certifyCapability.schemas.output.safeParse({
                status: 'PASS',
                specVersion: '1.0.0',
                generatedAt: '2024-01-15T10:30:00Z',
                gitSha: 'abc123',
                audits: [
                    {
                        id: 'nis-001-test',
                        name: 'Test Check',
                        status: 'PASS',
                        standard: 'NIS-001',
                        message: 'All tests passed',
                    },
                ],
                summary: {
                    total: 1,
                    passed: 1,
                    failed: 0,
                    warnings: 0,
                    skipped: 0,
                },
                reportPath: 'dist/CERTIFICATION.json',
            });
            expect(result.success).toBe(true);
        });

        it('accepts FAIL status with failed audits', () => {
            const result = certifyCapability.schemas.output.safeParse({
                status: 'FAIL',
                specVersion: '1.0.0',
                generatedAt: '2024-01-15T10:30:00Z',
                audits: [
                    {
                        id: 'vcs-001-test',
                        name: 'Version Check',
                        status: 'FAIL',
                        standard: 'VCS-001',
                        message: 'Invalid version format',
                        remediation: 'Update version to follow SemVer',
                    },
                ],
                summary: {
                    total: 1,
                    passed: 0,
                    failed: 1,
                    warnings: 0,
                    skipped: 0,
                },
                reportPath: 'dist/CERTIFICATION.json',
            });
            expect(result.success).toBe(true);
        });
    });
});
