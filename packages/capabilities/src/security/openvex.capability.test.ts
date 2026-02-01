/**
 * packages/capabilities/src/security/openvex.capability.test.ts
 * TCS-001 contract verification for OpenVEX capability.
 */
import { describe, it, expect } from 'vitest';
import { openvexCapability } from './openvex.capability.js';

describe('openvexCapability', () => {
    describe('TCS-001 contract verification', () => {
        it('validates aiHints examples against input schema', () => {
            expect(() =>
                openvexCapability.schemas.input.parse(openvexCapability.aiHints.exampleInput)
            ).not.toThrow();
        });

        it('validates aiHints examples against output schema', () => {
            expect(() =>
                openvexCapability.schemas.output.parse(openvexCapability.aiHints.exampleOutput)
            ).not.toThrow();
        });

        it('has required OCS metadata fields', () => {
            expect(openvexCapability.metadata.id).toBe('golden.security.openvex');
            expect(openvexCapability.metadata.version).toMatch(/^\d+\.\d+\.\d+$/);
            expect(openvexCapability.metadata.name).toBe('openvex');
            expect(openvexCapability.metadata.tags).toContain('vex');
            expect(openvexCapability.metadata.tags).toContain('openssf');
        });
    });

    describe('schema validation', () => {
        it('accepts all operations', () => {
            const operations = ['create', 'add-statement', 'merge', 'validate', 'filter-sbom'];
            for (const operation of operations) {
                expect(() =>
                    openvexCapability.schemas.input.parse({ operation })
                ).not.toThrow();
            }
        });

        it('accepts all statuses', () => {
            const statuses = ['not_affected', 'affected', 'fixed', 'under_investigation'];
            for (const status of statuses) {
                expect(() =>
                    openvexCapability.schemas.input.parse({
                        operation: 'create',
                        statements: [{ vulnerability: 'CVE-2024-1234', status }],
                    })
                ).not.toThrow();
            }
        });

        it('accepts all justifications', () => {
            const justifications = [
                'component_not_present',
                'vulnerable_code_not_present',
                'vulnerable_code_not_in_execute_path',
                'vulnerable_code_cannot_be_controlled_by_adversary',
                'inline_mitigations_already_exist',
            ];
            for (const justification of justifications) {
                expect(() =>
                    openvexCapability.schemas.input.parse({
                        operation: 'create',
                        statements: [{
                            vulnerability: 'CVE-2024-1234',
                            status: 'not_affected',
                            justification,
                        }],
                    })
                ).not.toThrow();
            }
        });

        it('accepts validation output with errors', () => {
            const result = openvexCapability.schemas.output.safeParse({
                success: false,
                operation: 'validate',
                validationErrors: ['Missing required field: author', 'Invalid status value'],
                message: 'Validation failed',
            });
            expect(result.success).toBe(true);
        });
    });

    describe('factory function', () => {
        it('builds a Dagger container for VEX creation', () => {
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
                        withExec() {
                            return builder;
                        },
                    };
                    return builder;
                },
            };

            openvexCapability.factory(
                fakeDag,
                {
                    ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
                    config: { defaultAuthor: 'security@example.com' },
                    secretRefs: {},
                },
                {
                    operation: 'create',
                    statements: [{ vulnerability: 'CVE-2024-1234', status: 'not_affected' }],
                }
            );

            expect(calls.from[0]).toContain('vexctl');
            expect(calls.env.some((e) => e.key === 'OPERATION' && e.value === 'create')).toBe(true);
        });
    });
});
