/**
 * packages/capabilities/src/observability/grafana-api.capability.test.ts
 * TCS-001 compliant tests for Grafana API capability
 */
import { describe, it, expect } from 'vitest';
import { grafanaApiCapability, type GrafanaApiConfig, type GrafanaApiSecrets } from './grafana-api.capability';

describe('grafanaApiCapability', () => {
    // ─────────────────────────────────────────────────────────────────────────────
    // Schema validation tests
    // ─────────────────────────────────────────────────────────────────────────────
    describe('schema validation', () => {
        it('validates aiHints.exampleInput against input schema', () => {
            expect(() =>
                grafanaApiCapability.schemas.input.parse(
                    grafanaApiCapability.aiHints.exampleInput
                )
            ).not.toThrow();
        });

        it('validates aiHints.exampleOutput against output schema', () => {
            expect(() =>
                grafanaApiCapability.schemas.output.parse(
                    grafanaApiCapability.aiHints.exampleOutput
                )
            ).not.toThrow();
        });

        it('accepts valid create-dashboard input', () => {
            const input = {
                operation: 'create-dashboard' as const,
                title: 'Test Dashboard',
                dashboardJson: {
                    title: 'Test Dashboard',
                    panels: [],
                },
                folderUid: 'general',
            };
            expect(() => grafanaApiCapability.schemas.input.parse(input)).not.toThrow();
        });

        it('accepts valid get-dashboard input', () => {
            const input = {
                operation: 'get-dashboard' as const,
                dashboardUid: 'abc123',
            };
            expect(() => grafanaApiCapability.schemas.input.parse(input)).not.toThrow();
        });

        it('accepts valid snapshot-dashboard input', () => {
            const input = {
                operation: 'snapshot-dashboard' as const,
                dashboardUid: 'abc123',
                snapshotName: 'Pre-deploy snapshot',
                snapshotExpires: 86400, // 24 hours
                snapshotExternal: true,
            };
            expect(() => grafanaApiCapability.schemas.input.parse(input)).not.toThrow();
        });

        it('accepts valid search-dashboards input', () => {
            const input = {
                operation: 'search-dashboards' as const,
                query: 'incident',
                tags: ['production', 'critical'],
            };
            expect(() => grafanaApiCapability.schemas.input.parse(input)).not.toThrow();
        });

        it('accepts valid create-folder input', () => {
            const input = {
                operation: 'create-folder' as const,
                title: 'Incidents',
            };
            expect(() => grafanaApiCapability.schemas.input.parse(input)).not.toThrow();
        });

        it('rejects invalid operation', () => {
            const input = {
                operation: 'invalid-operation',
            };
            expect(() => grafanaApiCapability.schemas.input.parse(input)).toThrow();
        });

        it('rejects negative snapshot expiry', () => {
            const input = {
                operation: 'snapshot-dashboard',
                dashboardUid: 'abc',
                snapshotExpires: -100,
            };
            expect(() => grafanaApiCapability.schemas.input.parse(input)).toThrow();
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // OCS metadata tests
    // ─────────────────────────────────────────────────────────────────────────────
    describe('OCS metadata compliance', () => {
        it('has required metadata fields', () => {
            expect(grafanaApiCapability.metadata.id).toBe('golden.observability.grafana-api');
            expect(grafanaApiCapability.metadata.version).toMatch(/^\d+\.\d+\.\d+$/);
            expect(grafanaApiCapability.metadata.name).toBe('grafanaApi');
            expect(grafanaApiCapability.metadata.description).toBeTruthy();
            expect(grafanaApiCapability.metadata.tags).toContain('grafana');
            expect(grafanaApiCapability.metadata.tags).toContain('observability');
            expect(grafanaApiCapability.metadata.maintainer).toBeTruthy();
        });

        it('has valid security configuration', () => {
            expect(grafanaApiCapability.security.requiredScopes).toContain('grafana:read');
            expect(grafanaApiCapability.security.requiredScopes).toContain('grafana:write');
            expect(grafanaApiCapability.security.dataClassification).toBe('INTERNAL');
            expect(grafanaApiCapability.security.networkAccess.allowOutbound).toBeDefined();
        });

        it('has valid operations configuration', () => {
            expect(grafanaApiCapability.operations.isIdempotent).toBe(false);
            expect(grafanaApiCapability.operations.retryPolicy).toBeDefined();
            expect(grafanaApiCapability.operations.retryPolicy.maxAttempts).toBeGreaterThan(0);
            expect(grafanaApiCapability.operations.costFactor).toBe('LOW');
            expect(typeof grafanaApiCapability.operations.errorMap).toBe('function');
        });

        it('has valid aiHints', () => {
            expect(grafanaApiCapability.aiHints.exampleInput).toBeDefined();
            expect(grafanaApiCapability.aiHints.exampleOutput).toBeDefined();
            expect(grafanaApiCapability.aiHints.usageNotes).toBeTruthy();
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // Commander pattern: error mapping tests
    // ─────────────────────────────────────────────────────────────────────────────
    describe('error mapping (Commander baseline)', () => {
        it('maps 401 errors to AUTH_FAILURE', () => {
            const error = new Error('HTTP 401 Unauthorized');
            expect(grafanaApiCapability.operations.errorMap(error)).toBe('AUTH_FAILURE');
        });

        it('maps 403 errors to AUTH_FAILURE', () => {
            const error = new Error('HTTP 403 Forbidden');
            expect(grafanaApiCapability.operations.errorMap(error)).toBe('AUTH_FAILURE');
        });

        it('maps 404 errors to FATAL', () => {
            const error = new Error('HTTP 404 Dashboard not found');
            expect(grafanaApiCapability.operations.errorMap(error)).toBe('FATAL');
        });

        it('maps 412 precondition errors to RETRYABLE', () => {
            const error = new Error('HTTP 412 Precondition Failed - version mismatch');
            expect(grafanaApiCapability.operations.errorMap(error)).toBe('RETRYABLE');
        });

        it('maps 429 errors to RATE_LIMIT', () => {
            const error = new Error('HTTP 429 Rate limit exceeded');
            expect(grafanaApiCapability.operations.errorMap(error)).toBe('RATE_LIMIT');
        });

        it('maps 5xx errors to RETRYABLE', () => {
            const error = new Error('HTTP 500 Internal Server Error');
            expect(grafanaApiCapability.operations.errorMap(error)).toBe('RETRYABLE');
        });

        it('maps timeout errors to RETRYABLE', () => {
            const error = new Error('Request timeout');
            expect(grafanaApiCapability.operations.errorMap(error)).toBe('RETRYABLE');
        });

        it('maps network errors to RETRYABLE', () => {
            const error = new Error('Network connection failed');
            expect(grafanaApiCapability.operations.errorMap(error)).toBe('RETRYABLE');
        });

        it('maps unknown errors to FATAL', () => {
            const error = new Error('Unknown error');
            expect(grafanaApiCapability.operations.errorMap(error)).toBe('FATAL');
        });

        it('maps non-Error objects to FATAL', () => {
            expect(grafanaApiCapability.operations.errorMap('string error')).toBe('FATAL');
            expect(grafanaApiCapability.operations.errorMap({ status: 500 })).toBe('FATAL');
            expect(grafanaApiCapability.operations.errorMap(null)).toBe('FATAL');
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
                config: {
                    grafanaUrl: 'https://grafana.example.com',
                } as GrafanaApiConfig,
                secretRefs: {} as GrafanaApiSecrets,
            };

            const input = {
                operation: 'list-folders' as const,
            };

            grafanaApiCapability.factory(fakeDag, context, input);

            expect(calls.from[0]).toContain('curlimages/curl');
            expect(calls.env.some((e) => e.key === 'INPUT_JSON')).toBe(true);
        });

        it('includes grafanaUrl in payload', () => {
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
                config: {
                    grafanaUrl: 'https://my-grafana.example.com',
                    orgId: 5,
                } as GrafanaApiConfig,
                secretRefs: {} as GrafanaApiSecrets,
            };

            const input = {
                operation: 'list-folders' as const,
            };

            grafanaApiCapability.factory(fakeDag, context, input);

            const parsed = JSON.parse(inputJson);
            expect(parsed.grafanaUrl).toBe('https://my-grafana.example.com');
            expect(parsed.orgId).toBe(5);
        });

        it('defaults orgId to 1 when not specified', () => {
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
                config: {
                    grafanaUrl: 'https://grafana.example.com',
                } as GrafanaApiConfig,
                secretRefs: {} as GrafanaApiSecrets,
            };

            const input = {
                operation: 'list-folders' as const,
            };

            grafanaApiCapability.factory(fakeDag, context, input);

            const parsed = JSON.parse(inputJson);
            expect(parsed.orgId).toBe(1);
        });

        it('prefers service account token over API key', () => {
            const mountedSecrets: string[] = [];

            const mockContainer = {
                from() {
                    return mockContainer;
                },
                withEnvVariable() {
                    return mockContainer;
                },
                withMountedSecret(path: string) {
                    mountedSecrets.push(path);
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
                config: {
                    grafanaUrl: 'https://grafana.example.com',
                } as GrafanaApiConfig,
                secretRefs: {
                    serviceAccountToken: 'sa-token-ref',
                    apiKey: 'api-key-ref',
                } as unknown as GrafanaApiSecrets,
            };

            const input = {
                operation: 'list-folders' as const,
            };

            grafanaApiCapability.factory(fakeDag, context, input);

            // Should only mount once (service account token)
            expect(mountedSecrets).toContain('/run/secrets/token');
            expect(mountedSecrets.length).toBe(1);
        });

        it('falls back to API key when service account token not provided', () => {
            const mountedSecrets: string[] = [];

            const mockContainer = {
                from() {
                    return mockContainer;
                },
                withEnvVariable() {
                    return mockContainer;
                },
                withMountedSecret(path: string) {
                    mountedSecrets.push(path);
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
                config: {
                    grafanaUrl: 'https://grafana.example.com',
                } as GrafanaApiConfig,
                secretRefs: {
                    apiKey: 'api-key-ref',
                } as unknown as GrafanaApiSecrets,
            };

            const input = {
                operation: 'list-folders' as const,
            };

            grafanaApiCapability.factory(fakeDag, context, input);

            expect(mountedSecrets).toContain('/run/secrets/token');
        });

        it('includes dashboard JSON in payload for create', () => {
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
                config: {
                    grafanaUrl: 'https://grafana.example.com',
                } as GrafanaApiConfig,
                secretRefs: {} as GrafanaApiSecrets,
            };

            const input = {
                operation: 'create-dashboard' as const,
                dashboardJson: {
                    title: 'Test',
                    panels: [{ id: 1, title: 'Panel 1' }],
                },
            };

            grafanaApiCapability.factory(fakeDag, context, input);

            const parsed = JSON.parse(inputJson);
            expect(parsed.dashboardJson).toEqual({
                title: 'Test',
                panels: [{ id: 1, title: 'Panel 1' }],
            });
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // Output schema validation
    // ─────────────────────────────────────────────────────────────────────────────
    describe('output schema', () => {
        it('validates dashboard creation output', () => {
            const output = {
                success: true,
                operation: 'create-dashboard' as const,
                dashboard: {
                    uid: 'abc123',
                    id: 42,
                    title: 'Test Dashboard',
                    url: '/d/abc123/test-dashboard',
                    version: 1,
                    folderUid: 'general',
                    tags: ['test'],
                },
                message: 'Dashboard created successfully',
            };
            expect(() => grafanaApiCapability.schemas.output.parse(output)).not.toThrow();
        });

        it('validates dashboard search output', () => {
            const output = {
                success: true,
                operation: 'search-dashboards' as const,
                dashboards: [
                    {
                        uid: 'dash-1',
                        id: 1,
                        title: 'Dashboard 1',
                        url: '/d/dash-1/dashboard-1',
                        version: 3,
                        folderUid: 'general',
                        folderTitle: 'General',
                        tags: ['production'],
                    },
                    {
                        uid: 'dash-2',
                        id: 2,
                        title: 'Dashboard 2',
                        url: '/d/dash-2/dashboard-2',
                        version: 1,
                    },
                ],
                message: 'Found 2 dashboards',
            };
            expect(() => grafanaApiCapability.schemas.output.parse(output)).not.toThrow();
        });

        it('validates snapshot output', () => {
            const output = {
                success: true,
                operation: 'snapshot-dashboard' as const,
                snapshot: {
                    key: 'snapshot-key-123',
                    url: 'https://grafana.example.com/dashboard/snapshot/snapshot-key-123',
                    deleteKey: 'delete-key-456',
                    deleteUrl: 'https://grafana.example.com/api/snapshots-delete/delete-key-456',
                    expiresAt: '2024-01-02T00:00:00Z',
                },
                message: 'Snapshot created successfully',
            };
            expect(() => grafanaApiCapability.schemas.output.parse(output)).not.toThrow();
        });

        it('validates folders list output', () => {
            const output = {
                success: true,
                operation: 'list-folders' as const,
                folders: [
                    {
                        uid: 'folder-1',
                        id: 1,
                        title: 'General',
                        url: '/dashboards/f/folder-1/general',
                    },
                    {
                        uid: 'folder-2',
                        id: 2,
                        title: 'Incidents',
                    },
                ],
                message: 'Retrieved 2 folders',
            };
            expect(() => grafanaApiCapability.schemas.output.parse(output)).not.toThrow();
        });

        it('validates datasources output', () => {
            const output = {
                success: true,
                operation: 'get-datasources' as const,
                datasources: [
                    {
                        id: 1,
                        uid: 'prometheus',
                        name: 'Prometheus',
                        type: 'prometheus',
                        url: 'http://prometheus:9090',
                        isDefault: true,
                    },
                    {
                        id: 2,
                        uid: 'loki',
                        name: 'Loki',
                        type: 'loki',
                        url: 'http://loki:3100',
                        isDefault: false,
                    },
                ],
                message: 'Retrieved 2 datasources',
            };
            expect(() => grafanaApiCapability.schemas.output.parse(output)).not.toThrow();
        });

        it('validates failure output', () => {
            const output = {
                success: false,
                operation: 'get-dashboard' as const,
                message: 'Failed to get dashboard: HTTP 404',
            };
            expect(() => grafanaApiCapability.schemas.output.parse(output)).not.toThrow();
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // Config schema validation
    // ─────────────────────────────────────────────────────────────────────────────
    describe('config schema', () => {
        it('validates config with required fields', () => {
            const config = {
                grafanaUrl: 'https://grafana.example.com',
            };
            expect(() => grafanaApiCapability.schemas.config.parse(config)).not.toThrow();
        });

        it('validates config with all fields', () => {
            const config = {
                grafanaUrl: 'https://grafana.example.com',
                orgId: 5,
                defaultFolderUid: 'incidents',
            };
            expect(() => grafanaApiCapability.schemas.config.parse(config)).not.toThrow();
        });

        it('rejects invalid URL', () => {
            const config = {
                grafanaUrl: 'not-a-url',
            };
            expect(() => grafanaApiCapability.schemas.config.parse(config)).toThrow();
        });

        it('rejects negative orgId', () => {
            const config = {
                grafanaUrl: 'https://grafana.example.com',
                orgId: -1,
            };
            expect(() => grafanaApiCapability.schemas.config.parse(config)).toThrow();
        });
    });
});
