/**
 * packages/capabilities/src/security/checkov.capability.test.ts
 * TCS-001 contract verification for Checkov capability.
 */
import { describe, it, expect } from 'vitest';
import { checkovCapability } from './checkov.capability.js';

describe('checkovCapability', () => {
    describe('TCS-001 contract verification', () => {
        it('validates aiHints examples against input schema', () => {
            expect(() =>
                checkovCapability.schemas.input.parse(checkovCapability.aiHints.exampleInput)
            ).not.toThrow();
        });

        it('validates aiHints examples against output schema', () => {
            expect(() =>
                checkovCapability.schemas.output.parse(checkovCapability.aiHints.exampleOutput)
            ).not.toThrow();
        });

        it('has required OCS metadata fields', () => {
            expect(checkovCapability.metadata.id).toBe('golden.security.checkov');
            expect(checkovCapability.metadata.version).toMatch(/^\d+\.\d+\.\d+$/);
            expect(checkovCapability.metadata.name).toBe('checkov');
            expect(checkovCapability.metadata.tags).toContain('iac');
            expect(checkovCapability.metadata.tags).toContain('terraform');
        });

        it('has OSCAL control mappings', () => {
            expect(checkovCapability.security.oscalControlIds).toContain('CM-6');
        });
    });

    describe('schema validation', () => {
        it('accepts all operations', () => {
            const operations = ['scan', 'scan-plan', 'list-checks'];
            for (const operation of operations) {
                expect(() =>
                    checkovCapability.schemas.input.parse({ operation })
                ).not.toThrow();
            }
        });

        it('accepts all frameworks', () => {
            const frameworks = [
                'terraform', 'terraform_plan', 'cloudformation', 'kubernetes',
                'helm', 'dockerfile', 'arm', 'bicep', 'serverless', 'all',
            ];
            for (const framework of frameworks) {
                expect(() =>
                    checkovCapability.schemas.input.parse({ operation: 'scan', framework })
                ).not.toThrow();
            }
        });

        it('accepts scan with checks and skip-checks', () => {
            const result = checkovCapability.schemas.input.safeParse({
                operation: 'scan',
                directory: 'deploy/',
                checks: ['CKV_AWS_1', 'CKV_AWS_2'],
                skipChecks: ['CKV_AWS_3'],
                softFail: true,
            });
            expect(result.success).toBe(true);
        });
    });

    describe('factory function', () => {
        it('builds a Dagger container for scanning', () => {
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

            checkovCapability.factory(
                fakeDag,
                {
                    ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
                    config: {},
                    secretRefs: {},
                },
                {
                    operation: 'scan',
                    directory: 'deploy/terraform',
                }
            );

            expect(calls.from[0]).toContain('checkov');
            expect(calls.env.some((e) => e.key === 'OPERATION' && e.value === 'scan')).toBe(true);
        });
    });
});
