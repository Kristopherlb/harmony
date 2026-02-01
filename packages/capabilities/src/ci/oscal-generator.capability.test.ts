/**
 * packages/capabilities/src/ci/oscal-generator.capability.test.ts
 * TCS-001 contract verification for OSCAL Generator capability.
 */
import { describe, it, expect } from 'vitest';
import { oscalGeneratorCapability } from './oscal-generator.capability.js';

describe('oscalGeneratorCapability', () => {
    describe('TCS-001 contract verification', () => {
        it('validates aiHints examples against input schema', () => {
            expect(() =>
                oscalGeneratorCapability.schemas.input.parse(oscalGeneratorCapability.aiHints.exampleInput)
            ).not.toThrow();
        });

        it('validates aiHints examples against output schema', () => {
            expect(() =>
                oscalGeneratorCapability.schemas.output.parse(oscalGeneratorCapability.aiHints.exampleOutput)
            ).not.toThrow();
        });

        it('has required OCS metadata fields', () => {
            expect(oscalGeneratorCapability.metadata.id).toBe('golden.ci.oscal-generator');
            expect(oscalGeneratorCapability.metadata.version).toMatch(/^\d+\.\d+\.\d+$/);
            expect(oscalGeneratorCapability.metadata.name).toBe('oscalGenerator');
            expect(oscalGeneratorCapability.metadata.description).toBeTruthy();
            expect(oscalGeneratorCapability.metadata.tags).toContain('ci');
            expect(oscalGeneratorCapability.metadata.tags).toContain('oscal');
        });

        it('declares no network access (runs locally)', () => {
            expect(oscalGeneratorCapability.security.networkAccess.allowOutbound).toEqual([]);
        });

        it('requires ci:read scope', () => {
            expect(oscalGeneratorCapability.security.requiredScopes).toContain('ci:read');
        });

        it('declares OSCAL control IDs', () => {
            expect(oscalGeneratorCapability.security.oscalControlIds).toContain('CA-2');
            expect(oscalGeneratorCapability.security.oscalControlIds).toContain('SA-11');
        });
    });

    describe('factory - generate operation', () => {
        it('builds a Dagger container for OSCAL generation', () => {
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

            oscalGeneratorCapability.factory(
                fakeDag,
                {
                    ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
                    config: {},
                    secretRefs: {},
                },
                {
                    operation: 'generate',
                    title: 'Harmony Platform',
                    version: '2.0.0',
                }
            );

            expect(calls.from[0]).toContain('node');
            expect(calls.env.some((e) => e.key === 'OPERATION' && e.value === 'generate')).toBe(true);
        });
    });

    describe('schema validation', () => {
        it('accepts all operations', () => {
            const operations = ['generate', 'extract-controls', 'validate'];

            for (const operation of operations) {
                expect(() =>
                    oscalGeneratorCapability.schemas.input.parse({ operation })
                ).not.toThrow();
            }
        });

        it('accepts valid OSCAL output', () => {
            const result = oscalGeneratorCapability.schemas.output.safeParse({
                outputPath: 'dist/oscal/component-definition.json',
                format: 'json',
                controlsCovered: ['AC-2', 'AU-2', 'CA-2', 'CM-2'],
                controlCount: 4,
                components: [
                    {
                        uuid: '550e8400-e29b-41d4-a716-446655440000',
                        type: 'software',
                        title: 'Harmony Platform',
                        controlCount: 4,
                    },
                ],
            });
            expect(result.success).toBe(true);
        });

        it('accepts output with implemented requirements', () => {
            const result = oscalGeneratorCapability.schemas.output.safeParse({
                outputPath: 'dist/oscal/component-definition.json',
                format: 'json',
                controlsCovered: ['AC-2'],
                controlCount: 1,
                components: [],
                implementedRequirements: [
                    {
                        uuid: '550e8400-e29b-41d4-a716-446655440001',
                        controlId: 'AC-2',
                        description: 'Account management via IAM integration',
                        implementedBy: ['golden.auth.iam-connector'],
                    },
                ],
            });
            expect(result.success).toBe(true);
        });
    });
});
