/**
 * packages/capabilities/src/connectors/confluence.capability.test.ts
 * TCS-001 compliant tests for Confluence Cloud connector capability
 */
import { describe, it, expect } from 'vitest';
import { confluenceCapability, type ConfluenceConfig, type ConfluenceSecrets } from './confluence.capability';

describe('confluenceCapability', () => {
    // ─────────────────────────────────────────────────────────────────────────────
    // Schema validation tests
    // ─────────────────────────────────────────────────────────────────────────────
    describe('schema validation', () => {
        it('validates aiHints.exampleInput against input schema', () => {
            expect(() =>
                confluenceCapability.schemas.input.parse(
                    confluenceCapability.aiHints.exampleInput
                )
            ).not.toThrow();
        });

        it('validates aiHints.exampleOutput against output schema', () => {
            expect(() =>
                confluenceCapability.schemas.output.parse(
                    confluenceCapability.aiHints.exampleOutput
                )
            ).not.toThrow();
        });

        it('accepts valid create-page input', () => {
            const input = {
                operation: 'create-page' as const,
                spaceKey: 'ENG',
                title: 'Test Page',
                body: '<p>Content</p>',
                bodyFormat: 'storage' as const,
            };
            expect(() => confluenceCapability.schemas.input.parse(input)).not.toThrow();
        });

        it('accepts valid update-page input', () => {
            const input = {
                operation: 'update-page' as const,
                pageId: '12345',
                title: 'Updated Title',
                body: '<p>New content</p>',
                version: 2,
            };
            expect(() => confluenceCapability.schemas.input.parse(input)).not.toThrow();
        });

        it('accepts valid search-pages input', () => {
            const input = {
                operation: 'search-pages' as const,
                cql: 'type=page AND space=ENG',
                limit: 50,
            };
            expect(() => confluenceCapability.schemas.input.parse(input)).not.toThrow();
        });

        it('accepts valid get-page-by-title input', () => {
            const input = {
                operation: 'get-page-by-title' as const,
                spaceKey: 'OPS',
                title: 'Runbook: Redis Failover',
            };
            expect(() => confluenceCapability.schemas.input.parse(input)).not.toThrow();
        });

        it('accepts all body formats', () => {
            const formats = ['storage', 'wiki', 'atlas_doc_format', 'markdown'] as const;
            for (const format of formats) {
                const input = {
                    operation: 'create-page' as const,
                    spaceKey: 'TEST',
                    title: 'Test',
                    bodyFormat: format,
                };
                expect(() => confluenceCapability.schemas.input.parse(input)).not.toThrow();
            }
        });

        it('rejects invalid operation', () => {
            const input = {
                operation: 'invalid-operation',
            };
            expect(() => confluenceCapability.schemas.input.parse(input)).toThrow();
        });

        it('rejects invalid body format', () => {
            const input = {
                operation: 'create-page',
                bodyFormat: 'html',
            };
            expect(() => confluenceCapability.schemas.input.parse(input)).toThrow();
        });

        it('rejects negative limit', () => {
            const input = {
                operation: 'search-pages',
                cql: 'type=page',
                limit: -5,
            };
            expect(() => confluenceCapability.schemas.input.parse(input)).toThrow();
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // OCS metadata tests
    // ─────────────────────────────────────────────────────────────────────────────
    describe('OCS metadata compliance', () => {
        it('has required metadata fields', () => {
            expect(confluenceCapability.metadata.id).toBe('golden.connectors.confluence');
            expect(confluenceCapability.metadata.version).toMatch(/^\d+\.\d+\.\d+$/);
            expect(confluenceCapability.metadata.name).toBe('confluenceConnector');
            expect(confluenceCapability.metadata.description).toBeTruthy();
            expect(confluenceCapability.metadata.tags).toContain('confluence');
            expect(confluenceCapability.metadata.tags).toContain('connector');
            expect(confluenceCapability.metadata.tags).toContain('atlassian');
            expect(confluenceCapability.metadata.maintainer).toBeTruthy();
        });

        it('has valid security configuration', () => {
            expect(confluenceCapability.security.requiredScopes).toContain('confluence:read');
            expect(confluenceCapability.security.requiredScopes).toContain('confluence:write');
            expect(confluenceCapability.security.dataClassification).toBe('INTERNAL');
            expect(confluenceCapability.security.networkAccess.allowOutbound).toContain('api.atlassian.com');
        });

        it('has valid operations configuration', () => {
            expect(confluenceCapability.operations.isIdempotent).toBe(false);
            expect(confluenceCapability.operations.retryPolicy).toBeDefined();
            expect(confluenceCapability.operations.retryPolicy.maxAttempts).toBeGreaterThan(0);
            expect(confluenceCapability.operations.costFactor).toBe('LOW');
            expect(typeof confluenceCapability.operations.errorMap).toBe('function');
        });

        it('has valid aiHints', () => {
            expect(confluenceCapability.aiHints.exampleInput).toBeDefined();
            expect(confluenceCapability.aiHints.exampleOutput).toBeDefined();
            expect(confluenceCapability.aiHints.usageNotes).toBeTruthy();
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // Connector pattern: error mapping tests
    // ─────────────────────────────────────────────────────────────────────────────
    describe('error mapping (Connector baseline)', () => {
        it('maps 401 errors to AUTH_FAILURE', () => {
            const error = new Error('HTTP 401 Unauthorized');
            expect(confluenceCapability.operations.errorMap(error)).toBe('AUTH_FAILURE');
        });

        it('maps 403 errors to AUTH_FAILURE', () => {
            const error = new Error('HTTP 403 Forbidden');
            expect(confluenceCapability.operations.errorMap(error)).toBe('AUTH_FAILURE');
        });

        it('maps 404 errors to FATAL', () => {
            const error = new Error('HTTP 404 Not Found');
            expect(confluenceCapability.operations.errorMap(error)).toBe('FATAL');
        });

        it('maps 409 conflict errors to RETRYABLE', () => {
            const error = new Error('HTTP 409 Conflict - version mismatch');
            expect(confluenceCapability.operations.errorMap(error)).toBe('RETRYABLE');
        });

        it('maps 429 errors to RATE_LIMIT', () => {
            const error = new Error('HTTP 429 Rate limit exceeded');
            expect(confluenceCapability.operations.errorMap(error)).toBe('RATE_LIMIT');
        });

        it('maps 5xx errors to RETRYABLE', () => {
            const error = new Error('HTTP 500 Internal Server Error');
            expect(confluenceCapability.operations.errorMap(error)).toBe('RETRYABLE');
        });

        it('maps timeout errors to RETRYABLE', () => {
            const error = new Error('Request timeout');
            expect(confluenceCapability.operations.errorMap(error)).toBe('RETRYABLE');
        });

        it('maps network errors to RETRYABLE', () => {
            const error = new Error('Network connection failed');
            expect(confluenceCapability.operations.errorMap(error)).toBe('RETRYABLE');
        });

        it('maps unknown errors to FATAL', () => {
            const error = new Error('Unknown error');
            expect(confluenceCapability.operations.errorMap(error)).toBe('FATAL');
        });

        it('maps non-Error objects to FATAL', () => {
            expect(confluenceCapability.operations.errorMap('string error')).toBe('FATAL');
            expect(confluenceCapability.operations.errorMap({ status: 500 })).toBe('FATAL');
            expect(confluenceCapability.operations.errorMap(null)).toBe('FATAL');
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
                    cloudId: 'test-cloud-id',
                    siteUrl: 'https://test.atlassian.net',
                } as ConfluenceConfig,
                secretRefs: {} as ConfluenceSecrets,
            };

            const input = {
                operation: 'list-spaces' as const,
            };

            confluenceCapability.factory(fakeDag, context, input);

            expect(calls.from[0]).toContain('curlimages/curl');
            expect(calls.env.some((e) => e.key === 'INPUT_JSON')).toBe(true);
        });

        it('includes cloudId and siteUrl in payload', () => {
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
                    cloudId: 'my-cloud-id',
                    siteUrl: 'https://mysite.atlassian.net',
                } as ConfluenceConfig,
                secretRefs: {} as ConfluenceSecrets,
            };

            const input = {
                operation: 'list-spaces' as const,
            };

            confluenceCapability.factory(fakeDag, context, input);

            const parsed = JSON.parse(inputJson);
            expect(parsed.cloudId).toBe('my-cloud-id');
            expect(parsed.siteUrl).toBe('https://mysite.atlassian.net');
        });

        it('uses default space key from config when not in input', () => {
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
                    cloudId: 'test-cloud',
                    siteUrl: 'https://test.atlassian.net',
                    defaultSpaceKey: 'DEFAULT',
                } as ConfluenceConfig,
                secretRefs: {} as ConfluenceSecrets,
            };

            const input = {
                operation: 'create-page' as const,
                title: 'Test Page',
            };

            confluenceCapability.factory(fakeDag, context, input);

            const parsed = JSON.parse(inputJson);
            expect(parsed.spaceKey).toBe('DEFAULT');
        });

        it('prefers input space key over config default', () => {
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
                    cloudId: 'test-cloud',
                    siteUrl: 'https://test.atlassian.net',
                    defaultSpaceKey: 'DEFAULT',
                } as ConfluenceConfig,
                secretRefs: {} as ConfluenceSecrets,
            };

            const input = {
                operation: 'create-page' as const,
                spaceKey: 'CUSTOM',
                title: 'Test Page',
            };

            confluenceCapability.factory(fakeDag, context, input);

            const parsed = JSON.parse(inputJson);
            expect(parsed.spaceKey).toBe('CUSTOM');
        });

        it('mounts email and API token secrets', () => {
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
                    cloudId: 'test-cloud',
                    siteUrl: 'https://test.atlassian.net',
                } as ConfluenceConfig,
                secretRefs: {
                    email: 'email-secret-ref',
                    apiToken: 'token-secret-ref',
                } as unknown as ConfluenceSecrets,
            };

            const input = {
                operation: 'list-spaces' as const,
            };

            confluenceCapability.factory(fakeDag, context, input);

            expect(mountedSecrets).toContain('/run/secrets/email');
            expect(mountedSecrets).toContain('/run/secrets/api_token');
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // Output schema validation
    // ─────────────────────────────────────────────────────────────────────────────
    describe('output schema', () => {
        it('validates page creation output', () => {
            const output = {
                success: true,
                operation: 'create-page' as const,
                page: {
                    id: '123456',
                    title: 'Test Page',
                    spaceKey: 'ENG',
                    version: 1,
                    webUrl: 'https://site.atlassian.net/wiki/spaces/ENG/pages/123456',
                    createdAt: '2024-01-01T00:00:00Z',
                    updatedAt: '2024-01-01T00:00:00Z',
                    status: 'current',
                },
                message: 'Page created successfully',
            };
            expect(() => confluenceCapability.schemas.output.parse(output)).not.toThrow();
        });

        it('validates pages list output', () => {
            const output = {
                success: true,
                operation: 'search-pages' as const,
                pages: [
                    {
                        id: '1',
                        title: 'Page 1',
                        spaceKey: 'ENG',
                        version: 3,
                        webUrl: 'https://site.atlassian.net/wiki/spaces/ENG/pages/1',
                        createdAt: '2024-01-01T00:00:00Z',
                        updatedAt: '2024-01-02T00:00:00Z',
                        status: 'current',
                    },
                    {
                        id: '2',
                        title: 'Page 2',
                        spaceKey: 'ENG',
                        version: 1,
                        webUrl: 'https://site.atlassian.net/wiki/spaces/ENG/pages/2',
                        createdAt: '2024-01-03T00:00:00Z',
                        updatedAt: '2024-01-03T00:00:00Z',
                        createdBy: 'user@example.com',
                        status: 'current',
                    },
                ],
                message: 'Found 2 pages',
            };
            expect(() => confluenceCapability.schemas.output.parse(output)).not.toThrow();
        });

        it('validates spaces list output', () => {
            const output = {
                success: true,
                operation: 'list-spaces' as const,
                spaces: [
                    {
                        id: 'space-1',
                        key: 'ENG',
                        name: 'Engineering',
                        type: 'global',
                        homepageId: '12345',
                    },
                    {
                        id: 'space-2',
                        key: 'OPS',
                        name: 'Operations',
                        type: 'global',
                    },
                ],
                message: 'Retrieved 2 spaces',
            };
            expect(() => confluenceCapability.schemas.output.parse(output)).not.toThrow();
        });

        it('validates failure output', () => {
            const output = {
                success: false,
                operation: 'get-page' as const,
                message: 'Failed to get page: HTTP 404',
            };
            expect(() => confluenceCapability.schemas.output.parse(output)).not.toThrow();
        });

        it('validates attachment output', () => {
            const output = {
                success: true,
                operation: 'add-attachment' as const,
                attachment: {
                    id: 'att-123',
                    title: 'report.pdf',
                    mediaType: 'application/pdf',
                    fileSize: 102400,
                    downloadUrl: 'https://site.atlassian.net/download/attachments/123/report.pdf',
                },
                message: 'Attachment uploaded successfully',
            };
            expect(() => confluenceCapability.schemas.output.parse(output)).not.toThrow();
        });
    });
});
