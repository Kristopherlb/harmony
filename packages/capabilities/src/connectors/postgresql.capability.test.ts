/**
 * packages/capabilities/src/connectors/postgresql.capability.test.ts
 * TCS-001 contract verification for PostgreSQL capability.
 */
import { describe, it, expect } from 'vitest';
import { postgresqlCapability } from './postgresql.capability.js';

describe('postgresqlCapability', () => {
    describe('TCS-001 contract verification', () => {
        it('validates aiHints examples against input schema', () => {
            expect(() =>
                postgresqlCapability.schemas.input.parse(postgresqlCapability.aiHints.exampleInput)
            ).not.toThrow();
        });

        it('validates aiHints examples against output schema', () => {
            expect(() =>
                postgresqlCapability.schemas.output.parse(postgresqlCapability.aiHints.exampleOutput)
            ).not.toThrow();
        });

        it('has required OCS metadata fields', () => {
            expect(postgresqlCapability.metadata.id).toBe('golden.connectors.postgresql');
            expect(postgresqlCapability.metadata.version).toMatch(/^\d+\.\d+\.\d+$/);
            expect(postgresqlCapability.metadata.name).toBe('postgresql');
            expect(postgresqlCapability.metadata.description).toBeTruthy();
            expect(postgresqlCapability.metadata.tags).toContain('connector');
        });
    });

    describe('factory - query', () => {
        it('builds a Dagger container for SQL query', () => {
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

            postgresqlCapability.factory(
                fakeDag,
                {
                    ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
                    config: { host: 'localhost', port: 5432, database: 'mydb' },
                    secretRefs: { password: '/secrets/pg-password' },
                },
                {
                    operation: 'query',
                    sql: 'SELECT * FROM users WHERE id = $1',
                    params: [123],
                }
            );

            expect(calls.from[0]).toContain('node:');
            expect(calls.env.some((e) => e.key === 'OPERATION' && e.value === 'query')).toBe(true);
        });
    });

    describe('factory - execute', () => {
        it('builds a Dagger container for SQL execution', () => {
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

            postgresqlCapability.factory(
                fakeDag,
                {
                    ctx: { app_id: 'app', environment: 'local', initiator_id: 'user', trace_id: 't' },
                    config: { host: 'localhost', port: 5432, database: 'mydb' },
                    secretRefs: { password: '/secrets/pg-password' },
                },
                {
                    operation: 'execute',
                    sql: 'INSERT INTO logs (message) VALUES ($1)',
                    params: ['Test log'],
                }
            );

            const operation = calls.env.find((e) => e.key === 'OPERATION');
            expect(operation?.value).toBe('execute');
        });
    });

    describe('schema validation', () => {
        it('accepts all operations', () => {
            const operations = ['query', 'execute', 'transaction'];

            for (const operation of operations) {
                expect(() =>
                    postgresqlCapability.schemas.input.parse({
                        operation,
                        sql: 'SELECT 1',
                    })
                ).not.toThrow();
            }
        });

        it('accepts transaction with multiple statements', () => {
            expect(() =>
                postgresqlCapability.schemas.input.parse({
                    operation: 'transaction',
                    statements: [
                        { sql: 'UPDATE accounts SET balance = balance - $1 WHERE id = $2', params: [100, 1] },
                        { sql: 'UPDATE accounts SET balance = balance + $1 WHERE id = $2', params: [100, 2] },
                    ],
                })
            ).not.toThrow();
        });
    });
});
