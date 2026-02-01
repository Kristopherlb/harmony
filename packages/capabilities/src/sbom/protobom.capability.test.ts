/**
 * packages/capabilities/src/sbom/protobom.capability.test.ts
 * TCS-001 contract verification for Protobom capability.
 */
import { describe, it, expect } from 'vitest';
import { protobomCapability } from './protobom.capability.js';

describe('protobomCapability', () => {
    describe('TCS-001 contract verification', () => {
        it('validates aiHints examples against input schema', () => {
            expect(() =>
                protobomCapability.schemas.input.parse(protobomCapability.aiHints.exampleInput)
            ).not.toThrow();
        });

        it('validates aiHints examples against output schema', () => {
            expect(() =>
                protobomCapability.schemas.output.parse(protobomCapability.aiHints.exampleOutput)
            ).not.toThrow();
        });

        it('has required OCS metadata fields', () => {
            expect(protobomCapability.metadata.id).toBe('golden.sbom.protobom');
            expect(protobomCapability.metadata.version).toMatch(/^\d+\.\d+\.\d+$/);
            expect(protobomCapability.metadata.name).toBe('protobom');
            expect(protobomCapability.metadata.tags).toContain('sbom');
            expect(protobomCapability.metadata.tags).toContain('spdx');
            expect(protobomCapability.metadata.tags).toContain('cyclonedx');
        });
    });

    describe('schema validation', () => {
        it('accepts all operations', () => {
            const operations = ['convert', 'validate', 'ingest', 'export'];
            for (const operation of operations) {
                expect(() =>
                    protobomCapability.schemas.input.parse({ operation })
                ).not.toThrow();
            }
        });

        it('accepts all formats', () => {
            const formats = [
                'spdx-2.3-json', 'spdx-2.3-tv', 'spdx-2.2-json',
                'cyclonedx-1.5-json', 'cyclonedx-1.4-json', 'protobom',
            ];
            for (const inputFormat of formats) {
                expect(() =>
                    protobomCapability.schemas.input.parse({ operation: 'convert', inputFormat })
                ).not.toThrow();
            }
        });

        it('accepts validation output with errors', () => {
            const result = protobomCapability.schemas.output.safeParse({
                success: false,
                operation: 'validate',
                valid: false,
                validationErrors: ['Missing required field', 'Invalid component reference'],
                message: 'Validation failed',
            });
            expect(result.success).toBe(true);
        });
    });

    describe('factory function', () => {
        it('builds a Dagger container for conversion', () => {
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

            protobomCapability.factory(
                fakeDag,
                {
                    ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
                    config: {},
                    secretRefs: {},
                },
                {
                    operation: 'convert',
                    sbomPath: 'input.json',
                    outputFormat: 'cyclonedx-1.5-json',
                }
            );

            expect(calls.from[0]).toContain('protobom');
            expect(calls.env.some((e) => e.key === 'OPERATION' && e.value === 'convert')).toBe(true);
        });
    });
});
