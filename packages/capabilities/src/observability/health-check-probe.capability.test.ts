/**
 * packages/capabilities/src/observability/health-check-probe.capability.test.ts
 * TCS-001 contract verification for Health Check Probe capability.
 */
import { describe, it, expect } from 'vitest';
import { healthCheckProbeCapability } from './health-check-probe.capability.js';

describe('healthCheckProbeCapability', () => {
    describe('TCS-001 contract verification', () => {
        it('validates aiHints examples against input schema', () => {
            expect(() =>
                healthCheckProbeCapability.schemas.input.parse(healthCheckProbeCapability.aiHints.exampleInput)
            ).not.toThrow();
        });

        it('validates aiHints examples against output schema', () => {
            expect(() =>
                healthCheckProbeCapability.schemas.output.parse(healthCheckProbeCapability.aiHints.exampleOutput)
            ).not.toThrow();
        });

        it('has required OCS metadata fields', () => {
            expect(healthCheckProbeCapability.metadata.id).toBe('golden.observability.health-check-probe');
            expect(healthCheckProbeCapability.metadata.version).toMatch(/^\d+\.\d+\.\d+$/);
            expect(healthCheckProbeCapability.metadata.name).toBe('healthCheckProbe');
            expect(healthCheckProbeCapability.metadata.description).toBeTruthy();
            expect(healthCheckProbeCapability.metadata.tags).toContain('observability');
        });
    });

    describe('factory - HTTP probe', () => {
        it('builds a Dagger container for HTTP health check', () => {
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

            healthCheckProbeCapability.factory(
                fakeDag,
                {
                    ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
                    config: {},
                    secretRefs: {},
                },
                {
                    probeType: 'http',
                    url: 'https://api.example.com/health',
                    expectedStatus: 200,
                }
            );

            expect(calls.from[0]).toContain('alpine');
            expect(calls.env.some((e) => e.key === 'PROBE_TYPE' && e.value === 'http')).toBe(true);
            expect(calls.env.some((e) => e.key === 'TARGET_URL' && e.value === 'https://api.example.com/health')).toBe(true);
        });
    });

    describe('factory - TCP probe', () => {
        it('builds a Dagger container for TCP health check', () => {
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

            healthCheckProbeCapability.factory(
                fakeDag,
                {
                    ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
                    config: {},
                    secretRefs: {},
                },
                {
                    probeType: 'tcp',
                    host: 'db.example.com',
                    port: 5432,
                }
            );

            const probeType = calls.env.find((e) => e.key === 'PROBE_TYPE');
            expect(probeType?.value).toBe('tcp');
        });
    });

    describe('schema validation', () => {
        it('accepts all probe types', () => {
            const probes = [
                { probeType: 'http', url: 'https://example.com' },
                { probeType: 'tcp', host: 'localhost', port: 80 },
                { probeType: 'dns', hostname: 'example.com' },
                { probeType: 'grpc', host: 'localhost', port: 50051 },
            ];

            for (const probe of probes) {
                expect(() =>
                    healthCheckProbeCapability.schemas.input.parse(probe)
                ).not.toThrow();
            }
        });

        it('accepts timeout configuration', () => {
            expect(() =>
                healthCheckProbeCapability.schemas.input.parse({
                    probeType: 'http',
                    url: 'https://example.com',
                    timeout: 5000,
                    retries: 3,
                })
            ).not.toThrow();
        });
    });
});
