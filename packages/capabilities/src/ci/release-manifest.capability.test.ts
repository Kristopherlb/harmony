/**
 * packages/capabilities/src/ci/release-manifest.capability.test.ts
 * TCS-001 contract verification for Release Manifest capability.
 */
import { describe, it, expect } from 'vitest';
import { releaseManifestCapability } from './release-manifest.capability.js';

describe('releaseManifestCapability', () => {
    describe('TCS-001 contract verification', () => {
        it('validates aiHints examples against input schema', () => {
            expect(() =>
                releaseManifestCapability.schemas.input.parse(releaseManifestCapability.aiHints.exampleInput)
            ).not.toThrow();
        });

        it('validates aiHints examples against output schema', () => {
            expect(() =>
                releaseManifestCapability.schemas.output.parse(releaseManifestCapability.aiHints.exampleOutput)
            ).not.toThrow();
        });

        it('has required OCS metadata fields', () => {
            expect(releaseManifestCapability.metadata.id).toBe('golden.ci.release-manifest');
            expect(releaseManifestCapability.metadata.version).toMatch(/^\d+\.\d+\.\d+$/);
            expect(releaseManifestCapability.metadata.name).toBe('releaseManifest');
            expect(releaseManifestCapability.metadata.description).toBeTruthy();
            expect(releaseManifestCapability.metadata.tags).toContain('ci');
            expect(releaseManifestCapability.metadata.tags).toContain('release');
        });

        it('declares no network access (runs locally)', () => {
            expect(releaseManifestCapability.security.networkAccess.allowOutbound).toEqual([]);
        });

        it('requires ci:write scope', () => {
            expect(releaseManifestCapability.security.requiredScopes).toContain('ci:write');
        });

        it('declares OSCAL control IDs', () => {
            expect(releaseManifestCapability.security.oscalControlIds).toContain('CM-2');
            expect(releaseManifestCapability.security.oscalControlIds).toContain('CM-3');
        });
    });

    describe('factory - generate operation', () => {
        it('builds a Dagger container for manifest generation', () => {
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

            releaseManifestCapability.factory(
                fakeDag,
                {
                    ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
                    config: {},
                    secretRefs: {},
                },
                {
                    operation: 'generate',
                    version: '2.0.0',
                    gitSha: 'abc123',
                }
            );

            expect(calls.from[0]).toContain('node');
            expect(calls.env.some((e) => e.key === 'OPERATION' && e.value === 'generate')).toBe(true);
            expect(calls.env.some((e) => e.key === 'VERSION' && e.value === '2.0.0')).toBe(true);
        });
    });

    describe('schema validation', () => {
        it('accepts all operations', () => {
            const operations = ['generate', 'validate', 'bundle'];

            for (const operation of operations) {
                expect(() =>
                    releaseManifestCapability.schemas.input.parse({
                        operation,
                        version: '1.0.0',
                    })
                ).not.toThrow();
            }
        });

        it('requires version', () => {
            expect(() =>
                releaseManifestCapability.schemas.input.parse({
                    operation: 'generate',
                })
            ).toThrow();
        });

        it('accepts input with security artifacts', () => {
            expect(() =>
                releaseManifestCapability.schemas.input.parse({
                    operation: 'generate',
                    version: '2.0.0',
                    security: {
                        trivyScanPath: 'dist/trivy.json',
                        gitleaksScanPath: 'dist/gitleaks.json',
                        sbomPath: 'dist/sbom.json',
                    },
                })
            ).not.toThrow();
        });

        it('accepts input with changelog', () => {
            expect(() =>
                releaseManifestCapability.schemas.input.parse({
                    operation: 'generate',
                    version: '2.0.0',
                    changelog: [
                        { type: 'feat', scope: 'api', description: 'Add new endpoint' },
                        { type: 'fix', description: 'Fix null pointer', commitSha: 'abc123' },
                        { type: 'chore', description: 'Update deps', breaking: false },
                    ],
                })
            ).not.toThrow();
        });

        it('accepts valid output with all sections', () => {
            const result = releaseManifestCapability.schemas.output.safeParse({
                manifestPath: 'dist/release-manifest.json',
                version: '2.0.0',
                gitSha: 'abc123',
                buildId: 'v2.0.0',
                certification: {
                    status: 'PASS',
                    reportPath: 'dist/CERTIFICATION.json',
                },
                oscal: {
                    componentDefinitionPath: 'dist/oscal/component-definition.json',
                    controlsCovered: ['AC-2', 'AU-2'],
                },
                coverage: {
                    statements: 85,
                    branches: 72,
                    reportPath: 'coverage/index.html',
                },
                security: {
                    vulnerabilities: 0,
                    secretLeaks: 0,
                    sbomPackages: 250,
                },
                featureFlags: {
                    flagdConfigPath: 'deploy/flagd/flags.json',
                    releaseGate: 'release-2.0.0-enabled',
                    flagCount: 15,
                },
                changelog: [
                    { type: 'feat', description: 'New feature' },
                ],
                generatedAt: '2024-01-15T10:30:00Z',
            });
            expect(result.success).toBe(true);
        });
    });
});
