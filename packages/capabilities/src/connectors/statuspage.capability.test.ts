/**
 * packages/capabilities/src/connectors/statuspage.capability.test.ts
 * TCS-001 compliant tests for Atlassian Statuspage connector capability
 */
import { describe, it, expect } from 'vitest';
import { statuspageCapability, type StatuspageConfig, type StatuspageSecrets } from './statuspage.capability';

describe('statuspageCapability', () => {
    // ─────────────────────────────────────────────────────────────────────────────
    // Schema validation tests
    // ─────────────────────────────────────────────────────────────────────────────
    describe('schema validation', () => {
        it('validates aiHints.exampleInput against input schema', () => {
            expect(() =>
                statuspageCapability.schemas.input.parse(
                    statuspageCapability.aiHints.exampleInput
                )
            ).not.toThrow();
        });

        it('validates aiHints.exampleOutput against output schema', () => {
            expect(() =>
                statuspageCapability.schemas.output.parse(
                    statuspageCapability.aiHints.exampleOutput
                )
            ).not.toThrow();
        });

        it('accepts valid create-incident input', () => {
            const input = {
                operation: 'create-incident' as const,
                name: 'Service Degradation',
                status: 'investigating' as const,
                impact: 'minor' as const,
            };
            expect(() => statuspageCapability.schemas.input.parse(input)).not.toThrow();
        });

        it('accepts valid update-incident input', () => {
            const input = {
                operation: 'update-incident' as const,
                incidentId: 'inc_123',
                status: 'identified' as const,
                body: 'We have identified the root cause.',
            };
            expect(() => statuspageCapability.schemas.input.parse(input)).not.toThrow();
        });

        it('accepts valid list-components input', () => {
            const input = {
                operation: 'list-components' as const,
                pageId: 'page_abc',
            };
            expect(() => statuspageCapability.schemas.input.parse(input)).not.toThrow();
        });

        it('accepts valid update-component input', () => {
            const input = {
                operation: 'update-component' as const,
                componentId: 'comp_xyz',
                componentStatus: 'degraded_performance' as const,
            };
            expect(() => statuspageCapability.schemas.input.parse(input)).not.toThrow();
        });

        it('rejects invalid operation', () => {
            const input = {
                operation: 'invalid-operation',
            };
            expect(() => statuspageCapability.schemas.input.parse(input)).toThrow();
        });

        it('rejects invalid incident status', () => {
            const input = {
                operation: 'create-incident',
                status: 'invalid-status',
            };
            expect(() => statuspageCapability.schemas.input.parse(input)).toThrow();
        });

        it('rejects invalid impact level', () => {
            const input = {
                operation: 'create-incident',
                impact: 'catastrophic',
            };
            expect(() => statuspageCapability.schemas.input.parse(input)).toThrow();
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // OCS metadata tests
    // ─────────────────────────────────────────────────────────────────────────────
    describe('OCS metadata compliance', () => {
        it('has required metadata fields', () => {
            expect(statuspageCapability.metadata.id).toBe('golden.connectors.statuspage');
            expect(statuspageCapability.metadata.version).toMatch(/^\d+\.\d+\.\d+$/);
            expect(statuspageCapability.metadata.name).toBe('statuspageConnector');
            expect(statuspageCapability.metadata.description).toBeTruthy();
            expect(statuspageCapability.metadata.tags).toContain('statuspage');
            expect(statuspageCapability.metadata.tags).toContain('connector');
            expect(statuspageCapability.metadata.maintainer).toBeTruthy();
        });

        it('has valid security configuration', () => {
            expect(statuspageCapability.security.requiredScopes).toContain('statuspage:read');
            expect(statuspageCapability.security.requiredScopes).toContain('statuspage:write');
            expect(statuspageCapability.security.dataClassification).toBe('INTERNAL');
            expect(statuspageCapability.security.networkAccess.allowOutbound).toContain('api.statuspage.io');
        });

        it('has valid operations configuration', () => {
            expect(statuspageCapability.operations.isIdempotent).toBe(false);
            expect(statuspageCapability.operations.retryPolicy).toBeDefined();
            expect(statuspageCapability.operations.retryPolicy.maxAttempts).toBeGreaterThan(0);
            expect(statuspageCapability.operations.costFactor).toBe('LOW');
            expect(typeof statuspageCapability.operations.errorMap).toBe('function');
        });

        it('has valid aiHints', () => {
            expect(statuspageCapability.aiHints.exampleInput).toBeDefined();
            expect(statuspageCapability.aiHints.exampleOutput).toBeDefined();
            expect(statuspageCapability.aiHints.usageNotes).toBeTruthy();
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // Connector pattern: error mapping tests
    // ─────────────────────────────────────────────────────────────────────────────
    describe('error mapping (Connector baseline)', () => {
        it('maps 401 errors to AUTH_FAILURE', () => {
            const error = new Error('HTTP 401 Unauthorized');
            expect(statuspageCapability.operations.errorMap(error)).toBe('AUTH_FAILURE');
        });

        it('maps 403 errors to AUTH_FAILURE', () => {
            const error = new Error('HTTP 403 Forbidden');
            expect(statuspageCapability.operations.errorMap(error)).toBe('AUTH_FAILURE');
        });

        it('maps 404 errors to FATAL', () => {
            const error = new Error('HTTP 404 Not Found');
            expect(statuspageCapability.operations.errorMap(error)).toBe('FATAL');
        });

        it('maps 429 errors to RATE_LIMIT', () => {
            const error = new Error('HTTP 429 Rate limit exceeded');
            expect(statuspageCapability.operations.errorMap(error)).toBe('RATE_LIMIT');
        });

        it('maps 5xx errors to RETRYABLE', () => {
            const error = new Error('HTTP 500 Internal Server Error');
            expect(statuspageCapability.operations.errorMap(error)).toBe('RETRYABLE');
        });

        it('maps timeout errors to RETRYABLE', () => {
            const error = new Error('Request timeout');
            expect(statuspageCapability.operations.errorMap(error)).toBe('RETRYABLE');
        });

        it('maps network errors to RETRYABLE', () => {
            const error = new Error('Network connection failed');
            expect(statuspageCapability.operations.errorMap(error)).toBe('RETRYABLE');
        });

        it('maps unknown errors to FATAL', () => {
            const error = new Error('Unknown error');
            expect(statuspageCapability.operations.errorMap(error)).toBe('FATAL');
        });

        it('maps non-Error objects to FATAL', () => {
            expect(statuspageCapability.operations.errorMap('string error')).toBe('FATAL');
            expect(statuspageCapability.operations.errorMap({ status: 500 })).toBe('FATAL');
            expect(statuspageCapability.operations.errorMap(null)).toBe('FATAL');
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // Factory shape tests
    // ─────────────────────────────────────────────────────────────────────────────
    describe('factory', () => {
        it('builds a Dagger container with curl image', () => {
            const calls: { from: string[]; env: { key: string; value: string }[] } = {
                from: [],
                env: [],
            };

            const mockContainer = {
                from(image: string) {
                    calls.from.push(image);
                    return mockContainer;
                },
                withEnvVariable(key: string, value: string) {
                    calls.env.push({ key, value });
                    return mockContainer;
                },
                withMountedSecret() {
                    return mockContainer;
                },
                withExec() {
                    return mockContainer;
                },
            };

            const fakeDag = {
                container() {
                    return mockContainer;
                },
            };

            const context = {
                config: { pageId: 'test_page' } as StatuspageConfig,
                secretRefs: {} as StatuspageSecrets,
            };

            const input = {
                operation: 'list-incidents' as const,
            };

            statuspageCapability.factory(fakeDag, context, input);

            expect(calls.from[0]).toContain('curlimages/curl');
            expect(calls.env.some((e) => e.key === 'INPUT_JSON')).toBe(true);
        });

        it('uses page ID from input over config default', () => {
            let inputJson = '';

            const mockContainer = {
                from() {
                    return mockContainer;
                },
                withEnvVariable(key: string, value: string) {
                    if (key === 'INPUT_JSON') {
                        inputJson = value;
                    }
                    return mockContainer;
                },
                withMountedSecret() {
                    return mockContainer;
                },
                withExec() {
                    return mockContainer;
                },
            };

            const fakeDag = {
                container() {
                    return mockContainer;
                },
            };

            const context = {
                config: { pageId: 'config_page' } as StatuspageConfig,
                secretRefs: {} as StatuspageSecrets,
            };

            const input = {
                operation: 'list-incidents' as const,
                pageId: 'input_page',
            };

            statuspageCapability.factory(fakeDag, context, input);

            const parsed = JSON.parse(inputJson);
            expect(parsed.pageId).toBe('input_page');
        });

        it('falls back to config page ID when not in input', () => {
            let inputJson = '';

            const mockContainer = {
                from() {
                    return mockContainer;
                },
                withEnvVariable(key: string, value: string) {
                    if (key === 'INPUT_JSON') {
                        inputJson = value;
                    }
                    return mockContainer;
                },
                withMountedSecret() {
                    return mockContainer;
                },
                withExec() {
                    return mockContainer;
                },
            };

            const fakeDag = {
                container() {
                    return mockContainer;
                },
            };

            const context = {
                config: { pageId: 'config_page' } as StatuspageConfig,
                secretRefs: {} as StatuspageSecrets,
            };

            const input = {
                operation: 'list-incidents' as const,
            };

            statuspageCapability.factory(fakeDag, context, input);

            const parsed = JSON.parse(inputJson);
            expect(parsed.pageId).toBe('config_page');
        });

        it('mounts API key secret when provided', () => {
            let secretMounted = false;
            let secretPath = '';

            const mockContainer = {
                from() {
                    return mockContainer;
                },
                withEnvVariable() {
                    return mockContainer;
                },
                withMountedSecret(path: string) {
                    secretMounted = true;
                    secretPath = path;
                    return mockContainer;
                },
                withExec() {
                    return mockContainer;
                },
            };

            const fakeDag = {
                container() {
                    return mockContainer;
                },
            };

            const context = {
                config: {} as StatuspageConfig,
                secretRefs: { apiKey: 'secret-ref' } as unknown as StatuspageSecrets,
            };

            const input = {
                operation: 'list-incidents' as const,
            };

            statuspageCapability.factory(fakeDag, context, input);

            expect(secretMounted).toBe(true);
            expect(secretPath).toBe('/run/secrets/api_key');
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // Output schema validation
    // ─────────────────────────────────────────────────────────────────────────────
    describe('output schema', () => {
        it('validates incident creation output', () => {
            const output = {
                success: true,
                operation: 'create-incident' as const,
                incident: {
                    id: 'inc_123',
                    name: 'Test Incident',
                    status: 'investigating' as const,
                    impact: 'minor' as const,
                    shortlink: 'https://stspg.io/abc',
                    pageId: 'page_xyz',
                    createdAt: '2024-01-01T00:00:00Z',
                    updatedAt: '2024-01-01T00:00:00Z',
                },
                message: 'Incident created successfully',
            };
            expect(() => statuspageCapability.schemas.output.parse(output)).not.toThrow();
        });

        it('validates incidents list output', () => {
            const output = {
                success: true,
                operation: 'list-incidents' as const,
                incidents: [
                    {
                        id: 'inc_1',
                        name: 'Incident 1',
                        status: 'resolved' as const,
                        impact: 'none' as const,
                        shortlink: 'https://stspg.io/1',
                        pageId: 'page_xyz',
                        createdAt: '2024-01-01T00:00:00Z',
                        updatedAt: '2024-01-01T01:00:00Z',
                        resolvedAt: '2024-01-01T01:00:00Z',
                    },
                ],
                message: 'Retrieved 1 incidents',
            };
            expect(() => statuspageCapability.schemas.output.parse(output)).not.toThrow();
        });

        it('validates components list output', () => {
            const output = {
                success: true,
                operation: 'list-components' as const,
                components: [
                    {
                        id: 'comp_1',
                        name: 'API',
                        status: 'operational' as const,
                        description: 'Main API service',
                        position: 1,
                    },
                    {
                        id: 'comp_2',
                        name: 'Database',
                        status: 'operational' as const,
                        position: 2,
                    },
                ],
                message: 'Retrieved 2 components',
            };
            expect(() => statuspageCapability.schemas.output.parse(output)).not.toThrow();
        });

        it('validates failure output', () => {
            const output = {
                success: false,
                operation: 'create-incident' as const,
                message: 'Failed to create incident: HTTP 401',
            };
            expect(() => statuspageCapability.schemas.output.parse(output)).not.toThrow();
        });
    });
});
