/**
 * packages/capabilities/src/security/security-insights.capability.test.ts
 * TCS-001 contract verification for Security Insights capability.
 */
import { describe, it, expect } from 'vitest';
import { securityInsightsCapability } from './security-insights.capability.js';

describe('securityInsightsCapability', () => {
    describe('TCS-001 contract verification', () => {
        it('validates aiHints examples against input schema', () => {
            expect(() =>
                securityInsightsCapability.schemas.input.parse(securityInsightsCapability.aiHints.exampleInput)
            ).not.toThrow();
        });

        it('validates aiHints examples against output schema', () => {
            expect(() =>
                securityInsightsCapability.schemas.output.parse(securityInsightsCapability.aiHints.exampleOutput)
            ).not.toThrow();
        });

        it('has required OCS metadata fields', () => {
            expect(securityInsightsCapability.metadata.id).toBe('golden.security.security-insights');
            expect(securityInsightsCapability.metadata.version).toMatch(/^\d+\.\d+\.\d+$/);
            expect(securityInsightsCapability.metadata.name).toBe('securityInsights');
<<<<<<< ours
            expect(securityInsightsCapability.metadata.description).toBeTruthy();
            expect(securityInsightsCapability.metadata.tags).toContain('commander');
            expect(securityInsightsCapability.metadata.tags).toContain('security');
=======
>>>>>>> theirs
            expect(securityInsightsCapability.metadata.tags).toContain('openssf');
        });
    });

<<<<<<< ours
    describe('factory - parse operation', () => {
        it('builds a Dagger container for parsing from repo URL', () => {
            const calls: { env: Array<{ key: string; value: string }>; exec: string[][]; from: string[] } = {
                env: [],
                exec: [],
=======
    describe('schema validation', () => {
        it('accepts all operations', () => {
            const operations = ['parse', 'generate', 'validate', 'update'];
            for (const operation of operations) {
                expect(() =>
                    securityInsightsCapability.schemas.input.parse({ operation })
                ).not.toThrow();
            }
        });

        it('accepts all status values', () => {
            const statuses = ['active', 'inactive', 'deprecated'];
            for (const status of statuses) {
                expect(() =>
                    securityInsightsCapability.schemas.input.parse({
                        operation: 'generate',
                        status,
                    })
                ).not.toThrow();
            }
        });

        it('accepts full generation input', () => {
            const result = securityInsightsCapability.schemas.input.safeParse({
                operation: 'generate',
                projectName: 'test-project',
                status: 'active',
                securityContacts: [
                    { type: 'email', value: 'security@test.com' },
                    { type: 'url', value: 'https://test.com/security' },
                ],
                vulnerabilityReporting: {
                    acceptsReports: true,
                    bugBounty: true,
                },
                dependencies: {
                    sbom: true,
                    sbomUrl: 'https://test.com/sbom.json',
                },
            });
            expect(result.success).toBe(true);
        });
    });

    describe('factory function', () => {
        it('builds a Dagger container for generation', () => {
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
                        withMountedSecret() {
                            return builder;
                        },
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

            securityInsightsCapability.factory(
                fakeDag,
                {
                    ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
                    config: {},
                    secretRefs: {},
                },
                {
<<<<<<< ours
                    operation: 'parse',
                    repoUrl: 'https://github.com/openssf/scorecard',
                }
            );

            expect(calls.from[0]).toContain('alpine');
            expect(calls.env.some((e) => e.key === 'OPERATION' && e.value === 'parse')).toBe(true);
            expect(calls.env.some((e) => e.key === 'REPO_URL')).toBe(true);
            expect(calls.exec.length).toBe(1);
        });
    });

    describe('factory - generate operation', () => {
        it('builds a Dagger container for generating security insights', () => {
            const calls: { env: Array<{ key: string; value: string }> } = { env: [] };
            const fakeDag = {
                container: () => ({
                    from: () => ({
                        withEnvVariable: (key: string, value: string) => {
                            calls.env.push({ key, value });
                            return fakeDag.container().from();
                        },
                        withMountedSecret: () => fakeDag.container().from(),
                        withExec: () => fakeDag.container().from(),
                    }),
                }),
            };

            securityInsightsCapability.factory(
                fakeDag,
                {
                    ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
                    config: {},
                    secretRefs: {},
                },
                {
                    operation: 'generate',
                    outputPath: '/SECURITY-INSIGHTS.yml',
                    contacts: [
                        { type: 'email', value: 'security@example.com', primary: true },
                    ],
                }
            );

            expect(calls.env.some((e) => e.key === 'OPERATION' && e.value === 'generate')).toBe(true);
            expect(calls.env.some((e) => e.key === 'OUTPUT_PATH')).toBe(true);
            expect(calls.env.some((e) => e.key === 'CONTACTS')).toBe(true);
        });
    });

    describe('schema validation', () => {
        it('accepts all operations', () => {
            const operations = ['parse', 'validate', 'generate', 'get-contacts', 'get-policy'];

            for (const operation of operations) {
                expect(() =>
                    securityInsightsCapability.schemas.input.parse({
                        operation,
                    })
                ).not.toThrow();
            }
        });

        it('accepts contact types', () => {
            expect(() =>
                securityInsightsCapability.schemas.input.parse({
                    operation: 'generate',
                    contacts: [
                        { type: 'email', value: 'security@example.com' },
                        { type: 'url', value: 'https://example.com/security' },
                    ],
                })
            ).not.toThrow();
        });

        it('rejects invalid operation', () => {
            expect(() =>
                securityInsightsCapability.schemas.input.parse({
                    operation: 'invalid',
                })
            ).toThrow();
        });

        it('validates full insights output', () => {
            expect(() =>
                securityInsightsCapability.schemas.output.parse({
                    success: true,
                    operation: 'parse',
                    insights: {
                        version: '1.0.0',
                        contacts: [{ type: 'email', value: 'security@example.com' }],
                        vulnerabilityPolicy: {
                            reportingUrl: 'https://example.com/security',
                            bugBounty: true,
                        },
                    },
                    message: 'Parsed',
                })
            ).not.toThrow();
=======
                    operation: 'generate',
                    projectName: 'test',
                }
            );

            expect(calls.from[0]).toContain('yq');
            expect(calls.env.some((e) => e.key === 'OPERATION' && e.value === 'generate')).toBe(true);
>>>>>>> theirs
        });
    });
});
