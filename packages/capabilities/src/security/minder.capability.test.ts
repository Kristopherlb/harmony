/**
 * packages/capabilities/src/security/minder.capability.test.ts
 * TCS-001 contract verification for Minder capability.
 */
import { describe, it, expect } from 'vitest';
import { minderCapability } from './minder.capability.js';

describe('minderCapability', () => {
    describe('TCS-001 contract verification', () => {
        it('validates aiHints examples against input schema', () => {
            expect(() =>
                minderCapability.schemas.input.parse(minderCapability.aiHints.exampleInput)
            ).not.toThrow();
        });

        it('validates aiHints examples against output schema', () => {
            expect(() =>
                minderCapability.schemas.output.parse(minderCapability.aiHints.exampleOutput)
            ).not.toThrow();
        });

        it('has required OCS metadata fields', () => {
            expect(minderCapability.metadata.id).toBe('golden.security.minder');
            expect(minderCapability.metadata.version).toMatch(/^\d+\.\d+\.\d+$/);
            expect(minderCapability.metadata.name).toBe('minder');
            expect(minderCapability.metadata.tags).toContain('openssf');
            expect(minderCapability.metadata.tags).toContain('policy');
        });

        it('has OSCAL control mappings', () => {
            expect(minderCapability.security.oscalControlIds).toContain('CM-1');
        });
    });

    describe('schema validation', () => {
        it('accepts all operations', () => {
            const operations = [
                'enroll-repo', 'apply-profile', 'evaluate',
                'list-violations', 'remediate', 'get-status',
            ];
            for (const operation of operations) {
                expect(() =>
                    minderCapability.schemas.input.parse({ operation })
                ).not.toThrow();
            }
        });

        it('accepts remediation actions', () => {
            const actions = ['none', 'alert', 'auto_fix', 'pull_request'];
            for (const remediationAction of actions) {
                expect(() =>
                    minderCapability.schemas.input.parse({ operation: 'evaluate', remediationAction })
                ).not.toThrow();
            }
        });

        it('accepts violations output', () => {
            const result = minderCapability.schemas.output.safeParse({
                success: true,
                operation: 'list-violations',
                violations: [
                    {
                        rule: 'secret_scanning',
                        severity: 'critical',
                        description: 'Secret scanning not enabled',
                        autoRemediable: true,
                    },
                ],
                message: 'Found 1 violation',
            });
            expect(result.success).toBe(true);
        });
    });

    describe('factory function', () => {
        it('builds a Dagger container for evaluation', () => {
            const calls: { env: Array<{ key: string; value: string }>; from: string[] } = {
                env: [],
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
                        withMountedSecret() {
                            return builder;
                        },
                        withExec() {
                            return builder;
                        },
                    };
                    return builder;
                },
            };

            minderCapability.factory(
                fakeDag,
                {
                    ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
                    config: {},
                    secretRefs: {},
                },
                {
                    operation: 'evaluate',
                    repoOwner: 'org',
                    repoName: 'repo',
                }
            );

            expect(calls.from[0]).toContain('minder');
            expect(calls.env.some((e) => e.key === 'OPERATION' && e.value === 'evaluate')).toBe(true);
        });
    });
});
