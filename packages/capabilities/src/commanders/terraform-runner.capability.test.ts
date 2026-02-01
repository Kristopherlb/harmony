/**
 * packages/capabilities/src/commanders/terraform-runner.capability.test.ts
 * TCS-001 contract verification for Terraform Runner capability.
 */
import { describe, it, expect } from 'vitest';
import { terraformRunnerCapability } from './terraform-runner.capability.js';

describe('terraformRunnerCapability', () => {
    describe('TCS-001 contract verification', () => {
        it('validates aiHints examples against input schema', () => {
            expect(() =>
                terraformRunnerCapability.schemas.input.parse(terraformRunnerCapability.aiHints.exampleInput)
            ).not.toThrow();
        });

        it('validates aiHints examples against output schema', () => {
            expect(() =>
                terraformRunnerCapability.schemas.output.parse(terraformRunnerCapability.aiHints.exampleOutput)
            ).not.toThrow();
        });

        it('has required OCS metadata fields', () => {
            expect(terraformRunnerCapability.metadata.id).toBe('golden.commanders.terraform-runner');
            expect(terraformRunnerCapability.metadata.version).toMatch(/^\d+\.\d+\.\d+$/);
            expect(terraformRunnerCapability.metadata.name).toBe('terraformRunner');
            expect(terraformRunnerCapability.metadata.description).toBeTruthy();
            expect(terraformRunnerCapability.metadata.tags).toContain('commander');
        });
    });

    describe('factory - plan', () => {
        it('builds a Dagger container for terraform plan', () => {
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

            terraformRunnerCapability.factory(
                fakeDag,
                {
                    ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
                    config: { workingDir: '/terraform' },
                    secretRefs: {},
                },
                {
                    command: 'plan',
                    variables: { instance_type: 't3.micro' },
                }
            );

            expect(calls.from[0]).toContain('terraform');
            expect(calls.env.some((e) => e.key === 'TF_COMMAND' && e.value === 'plan')).toBe(true);
        });
    });

    describe('factory - apply', () => {
        it('builds a Dagger container for terraform apply', () => {
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

            terraformRunnerCapability.factory(
                fakeDag,
                {
                    ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
                    config: { workingDir: '/terraform' },
                    secretRefs: {},
                },
                {
                    command: 'apply',
                    autoApprove: true,
                }
            );

            const command = calls.env.find((e) => e.key === 'TF_COMMAND');
            expect(command?.value).toBe('apply');
        });
    });

    describe('schema validation', () => {
        it('accepts all terraform commands', () => {
            const commands = ['init', 'plan', 'apply', 'destroy', 'output', 'validate', 'fmt'];

            for (const command of commands) {
                expect(() =>
                    terraformRunnerCapability.schemas.input.parse({ command })
                ).not.toThrow();
            }
        });

        it('accepts variables', () => {
            expect(() =>
                terraformRunnerCapability.schemas.input.parse({
                    command: 'plan',
                    variables: {
                        region: 'us-east-1',
                        instance_count: 3,
                    },
                })
            ).not.toThrow();
        });
    });
});
