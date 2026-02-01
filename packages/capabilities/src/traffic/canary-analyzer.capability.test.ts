/**
 * packages/capabilities/src/traffic/canary-analyzer.capability.test.ts
 * TCS-001 contract verification for Canary Analyzer capability.
 */
import { describe, it, expect } from 'vitest';
import { canaryAnalyzerCapability } from './canary-analyzer.capability.js';

describe('canaryAnalyzerCapability', () => {
    describe('TCS-001 contract verification', () => {
        it('validates aiHints examples against input schema', () => {
            expect(() =>
                canaryAnalyzerCapability.schemas.input.parse(canaryAnalyzerCapability.aiHints.exampleInput)
            ).not.toThrow();
        });

        it('validates aiHints examples against output schema', () => {
            expect(() =>
                canaryAnalyzerCapability.schemas.output.parse(canaryAnalyzerCapability.aiHints.exampleOutput)
            ).not.toThrow();
        });

        it('has required OCS metadata fields', () => {
            expect(canaryAnalyzerCapability.metadata.id).toBe('golden.traffic.canary-analyzer');
            expect(canaryAnalyzerCapability.metadata.version).toMatch(/^\d+\.\d+\.\d+$/);
            expect(canaryAnalyzerCapability.metadata.name).toBe('canaryAnalyzer');
            expect(canaryAnalyzerCapability.metadata.description).toBeTruthy();
            expect(canaryAnalyzerCapability.metadata.tags).toContain('traffic');
            expect(canaryAnalyzerCapability.metadata.tags).toContain('canary');
        });

        it('declares correct network access for Prometheus', () => {
            expect(canaryAnalyzerCapability.security.networkAccess.allowOutbound).toContain('prometheus:9090');
        });

        it('requires metrics:read scope', () => {
            expect(canaryAnalyzerCapability.security.requiredScopes).toContain('metrics:read');
        });

        it('declares OSCAL control IDs for monitoring', () => {
            expect(canaryAnalyzerCapability.security.oscalControlIds).toContain('SI-4');
            expect(canaryAnalyzerCapability.security.oscalControlIds).toContain('CA-7');
        });
    });

    describe('factory - analyze operation', () => {
        it('builds a Dagger container for canary analysis', () => {
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
                        withMountedSecret() {
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

            canaryAnalyzerCapability.factory(
                fakeDag,
                {
                    ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
                    config: {},
                    secretRefs: {},
                },
                {
                    operation: 'analyze',
                    baselineVersion: 'v1.9.0',
                    canaryVersion: 'v2.0.0',
                    prometheusUrl: 'http://prometheus:9090',
                }
            );

            expect(calls.from[0]).toContain('curl');
            expect(calls.env.some((e) => e.key === 'OPERATION' && e.value === 'analyze')).toBe(true);
            expect(calls.env.some((e) => e.key === 'PROMETHEUS_URL' && e.value === 'http://prometheus:9090')).toBe(true);
        });
    });

    describe('schema validation', () => {
        it('accepts all operations', () => {
            const operations = ['analyze', 'compare-metrics', 'get-decision'];

            for (const operation of operations) {
                expect(() =>
                    canaryAnalyzerCapability.schemas.input.parse({
                        operation,
                        baselineVersion: 'v1.0.0',
                        canaryVersion: 'v2.0.0',
                        prometheusUrl: 'http://prometheus:9090',
                    })
                ).not.toThrow();
            }
        });

        it('accepts all metric types', () => {
            const metrics = ['error_rate', 'latency_p50', 'latency_p90', 'latency_p99', 'throughput', 'success_rate', 'saturation'];

            expect(() =>
                canaryAnalyzerCapability.schemas.input.parse({
                    operation: 'analyze',
                    baselineVersion: 'v1.0.0',
                    canaryVersion: 'v2.0.0',
                    prometheusUrl: 'http://prometheus:9090',
                    metrics,
                })
            ).not.toThrow();
        });

        it('enforces error rate threshold bounds', () => {
            expect(() =>
                canaryAnalyzerCapability.schemas.input.parse({
                    operation: 'analyze',
                    baselineVersion: 'v1.0.0',
                    canaryVersion: 'v2.0.0',
                    prometheusUrl: 'http://prometheus:9090',
                    errorRateThreshold: 1.5,
                })
            ).toThrow();

            expect(() =>
                canaryAnalyzerCapability.schemas.input.parse({
                    operation: 'analyze',
                    baselineVersion: 'v1.0.0',
                    canaryVersion: 'v2.0.0',
                    prometheusUrl: 'http://prometheus:9090',
                    errorRateThreshold: -0.1,
                })
            ).toThrow();
        });

        it('accepts valid output with PROMOTE decision', () => {
            const result = canaryAnalyzerCapability.schemas.output.safeParse({
                decision: 'PROMOTE',
                baselineVersion: 'v1.9.0',
                canaryVersion: 'v2.0.0',
                baselineMetrics: { error_rate: 0.01 },
                canaryMetrics: { error_rate: 0.012 },
                deltas: { error_rate: 0.002 },
                metricResults: [
                    {
                        metric: 'error_rate',
                        baselineValue: 0.01,
                        canaryValue: 0.012,
                        delta: 0.002,
                        deltaPercent: 20,
                        threshold: 0.05,
                        passed: true,
                    },
                ],
                reason: 'Canary healthy',
                analysisWindowSeconds: 600,
                analyzedAt: '2024-01-15T10:30:00Z',
            });
            expect(result.success).toBe(true);
        });

        it('accepts valid output with ROLLBACK decision', () => {
            const result = canaryAnalyzerCapability.schemas.output.safeParse({
                decision: 'ROLLBACK',
                baselineVersion: 'v1.9.0',
                canaryVersion: 'v2.0.0',
                baselineMetrics: { error_rate: 0.01 },
                canaryMetrics: { error_rate: 0.15 },
                deltas: { error_rate: 0.14 },
                metricResults: [
                    {
                        metric: 'error_rate',
                        baselineValue: 0.01,
                        canaryValue: 0.15,
                        delta: 0.14,
                        deltaPercent: 1400,
                        threshold: 0.05,
                        passed: false,
                    },
                ],
                reason: 'Error rate exceeded threshold',
                analysisWindowSeconds: 600,
                analyzedAt: '2024-01-15T10:30:00Z',
            });
            expect(result.success).toBe(true);
        });
    });
});
