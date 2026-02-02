/**
 * packages/capabilities/src/operations/runme-runner.capability.test.ts
 * TCS-001 compliant tests for Runme Runner capability
 */
import { describe, it, expect, vi } from 'vitest';
import { runmeRunnerCapability, type RunmeRunnerConfig, type RunmeRunnerSecrets } from './runme-runner.capability';

describe('runmeRunnerCapability', () => {
    // ─────────────────────────────────────────────────────────────────────────────
    // Schema validation tests
    // ─────────────────────────────────────────────────────────────────────────────
    describe('schema validation', () => {
        it('validates aiHints.exampleInput against input schema', () => {
            expect(() =>
                runmeRunnerCapability.schemas.input.parse(
                    runmeRunnerCapability.aiHints.exampleInput
                )
            ).not.toThrow();
        });

        it('validates aiHints.exampleOutput against output schema', () => {
            expect(() =>
                runmeRunnerCapability.schemas.output.parse(
                    runmeRunnerCapability.aiHints.exampleOutput
                )
            ).not.toThrow();
        });

        it('accepts valid file source input', () => {
            const input = {
                source: '/path/to/runbook.md',
                sourceType: 'file' as const,
            };
            expect(() => runmeRunnerCapability.schemas.input.parse(input)).not.toThrow();
        });

        it('accepts valid raw markdown input', () => {
            const input = {
                source: '# Runbook\n\n```bash\necho "hello"\n```',
                sourceType: 'raw' as const,
                cells: ['cell-1'],
                env: { MY_VAR: 'value' },
                timeout: '10m',
            };
            expect(() => runmeRunnerCapability.schemas.input.parse(input)).not.toThrow();
        });

        it('rejects empty source', () => {
            const input = {
                source: '',
                sourceType: 'file' as const,
            };
            expect(() => runmeRunnerCapability.schemas.input.parse(input)).toThrow();
        });

        it('rejects invalid sourceType', () => {
            const input = {
                source: '/path/to/runbook.md',
                sourceType: 'invalid',
            };
            expect(() => runmeRunnerCapability.schemas.input.parse(input)).toThrow();
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // OCS metadata tests
    // ─────────────────────────────────────────────────────────────────────────────
    describe('OCS metadata compliance', () => {
        it('has required metadata fields', () => {
            expect(runmeRunnerCapability.metadata.id).toBe('golden.operations.runme-runner');
            expect(runmeRunnerCapability.metadata.version).toMatch(/^\d+\.\d+\.\d+$/);
            expect(runmeRunnerCapability.metadata.name).toBe('runmeRunner');
            expect(runmeRunnerCapability.metadata.description).toBeTruthy();
            expect(runmeRunnerCapability.metadata.tags).toContain('runme');
            expect(runmeRunnerCapability.metadata.tags).toContain('commander');
            expect(runmeRunnerCapability.metadata.maintainer).toBeTruthy();
        });

        it('has valid security configuration', () => {
            expect(runmeRunnerCapability.security.requiredScopes).toContain('operations:execute');
            expect(runmeRunnerCapability.security.dataClassification).toBe('INTERNAL');
            expect(runmeRunnerCapability.security.networkAccess.allowOutbound).toBeDefined();
        });

        it('has valid operations configuration', () => {
            expect(runmeRunnerCapability.operations.isIdempotent).toBe(false);
            expect(runmeRunnerCapability.operations.retryPolicy).toBeDefined();
            expect(runmeRunnerCapability.operations.costFactor).toBe('MEDIUM');
            expect(typeof runmeRunnerCapability.operations.errorMap).toBe('function');
        });

        it('has valid aiHints', () => {
            expect(runmeRunnerCapability.aiHints.exampleInput).toBeDefined();
            expect(runmeRunnerCapability.aiHints.exampleOutput).toBeDefined();
            expect(runmeRunnerCapability.aiHints.usageNotes).toBeTruthy();
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // Commander pattern: error mapping tests
    // ─────────────────────────────────────────────────────────────────────────────
    describe('error mapping (Commander baseline)', () => {
        it('maps timeout errors to RETRYABLE', () => {
            const error = new Error('Command timeout exceeded');
            expect(runmeRunnerCapability.operations.errorMap(error)).toBe('RETRYABLE');
        });

        it('maps file not found errors to FATAL', () => {
            const error = new Error('File not found: /path/to/runbook.md');
            expect(runmeRunnerCapability.operations.errorMap(error)).toBe('FATAL');
        });

        it('maps permission denied errors to FATAL', () => {
            const error = new Error('Permission denied');
            expect(runmeRunnerCapability.operations.errorMap(error)).toBe('FATAL');
        });

        it('maps network errors to RETRYABLE', () => {
            const error = new Error('Network connection failed');
            expect(runmeRunnerCapability.operations.errorMap(error)).toBe('RETRYABLE');
        });

        it('maps unknown errors to FATAL', () => {
            const error = new Error('Unknown error occurred');
            expect(runmeRunnerCapability.operations.errorMap(error)).toBe('FATAL');
        });

        it('maps non-Error objects to FATAL', () => {
            expect(runmeRunnerCapability.operations.errorMap('string error')).toBe('FATAL');
            expect(runmeRunnerCapability.operations.errorMap({ code: 1 })).toBe('FATAL');
            expect(runmeRunnerCapability.operations.errorMap(null)).toBe('FATAL');
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // Factory shape tests
    // ─────────────────────────────────────────────────────────────────────────────
    describe('factory', () => {
        it('builds a Dagger container with correct image', () => {
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
                config: {} as RunmeRunnerConfig,
                secretRefs: {} as RunmeRunnerSecrets,
            };

            const input = {
                source: '/runbooks/test.md',
                sourceType: 'file' as const,
            };

            runmeRunnerCapability.factory(fakeDag, context, input);

            expect(calls.from[0]).toContain('ghcr.io/stateful/runme');
            expect(calls.env.some((e) => e.key === 'INPUT_JSON')).toBe(true);
        });

        it('uses specified runme version from config', () => {
            const calls: { from: string[] } = { from: [] };

            const mockContainer = {
                from(image: string) {
                    calls.from.push(image);
                    return mockContainer;
                },
                withEnvVariable() {
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
                config: { runmeVersion: '3.0.0' } as RunmeRunnerConfig,
                secretRefs: {} as RunmeRunnerSecrets,
            };

            const input = {
                source: '/runbooks/test.md',
                sourceType: 'file' as const,
            };

            runmeRunnerCapability.factory(fakeDag, context, input);

            expect(calls.from[0]).toBe('ghcr.io/stateful/runme:3.0.0');
        });

        it('injects environment variables from input', () => {
            const calls: { env: { key: string; value: string }[] } = { env: [] };

            const mockContainer = {
                from() {
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
                config: {} as RunmeRunnerConfig,
                secretRefs: {} as RunmeRunnerSecrets,
            };

            const input = {
                source: '/runbooks/test.md',
                sourceType: 'file' as const,
                env: { MY_VAR: 'my_value', ANOTHER_VAR: 'another_value' },
            };

            runmeRunnerCapability.factory(fakeDag, context, input);

            expect(calls.env.some((e) => e.key === 'MY_VAR' && e.value === 'my_value')).toBe(true);
            expect(calls.env.some((e) => e.key === 'ANOTHER_VAR' && e.value === 'another_value')).toBe(true);
        });

        it('includes cells in INPUT_JSON when specified', () => {
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
                config: {} as RunmeRunnerConfig,
                secretRefs: {} as RunmeRunnerSecrets,
            };

            const input = {
                source: '/runbooks/test.md',
                sourceType: 'file' as const,
                cells: ['cell-1', 'cell-2'],
            };

            runmeRunnerCapability.factory(fakeDag, context, input);

            const parsed = JSON.parse(inputJson);
            expect(parsed.cells).toEqual(['cell-1', 'cell-2']);
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // Output schema validation
    // ─────────────────────────────────────────────────────────────────────────────
    describe('output schema', () => {
        it('validates successful execution output', () => {
            const output = {
                cells: [
                    {
                        id: 'cell-1',
                        name: 'First Cell',
                        exitCode: 0,
                        stdout: 'Success output',
                        stderr: '',
                        durationMs: 1000,
                    },
                ],
                success: true,
                totalDurationMs: 1000,
                runbookPath: '/path/to/runbook.md',
                message: 'All cells completed successfully',
            };
            expect(() => runmeRunnerCapability.schemas.output.parse(output)).not.toThrow();
        });

        it('validates failed execution output', () => {
            const output = {
                cells: [
                    {
                        id: 'cell-1',
                        exitCode: 1,
                        stdout: '',
                        stderr: 'Error: command failed',
                        durationMs: 500,
                    },
                ],
                success: false,
                totalDurationMs: 500,
                message: 'Execution failed with exit code 1',
            };
            expect(() => runmeRunnerCapability.schemas.output.parse(output)).not.toThrow();
        });

        it('validates multi-cell output', () => {
            const output = {
                cells: [
                    { id: 'setup', exitCode: 0, stdout: 'Setup complete', stderr: '', durationMs: 100 },
                    { id: 'execute', exitCode: 0, stdout: 'Executed', stderr: '', durationMs: 200 },
                    { id: 'cleanup', exitCode: 0, stdout: 'Cleaned up', stderr: '', durationMs: 50 },
                ],
                success: true,
                totalDurationMs: 350,
                message: 'All 3 cells completed successfully',
            };
            expect(() => runmeRunnerCapability.schemas.output.parse(output)).not.toThrow();
        });
    });
});
