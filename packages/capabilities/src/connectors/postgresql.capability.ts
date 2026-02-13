/**
 * packages/capabilities/src/connectors/postgresql.capability.ts
 * PostgreSQL Capability (OCS-001 Connector Pattern)
 *
 * Provides PostgreSQL database operations: queries, executions, and transactions.
 */
import { z } from '@golden/schema-registry';
import type { Capability, CapabilityContext } from '@golden/core';

const operationSchema = z.enum([
  'query',
  'execute',
  'transaction',
]).describe('Database operation type');

const statementSchema = z.object({
  sql: z.string().describe('SQL statement'),
  params: z.array(z.unknown()).optional().describe('Query parameters'),
});

const inputSchema = z
  .object({
    operation: operationSchema,
    sql: z.string().optional().describe('SQL query or statement'),
    params: z.array(z.unknown()).optional().describe('Query parameters (for parameterized queries)'),
    statements: z.array(statementSchema).optional().describe('Statements for transaction'),
    timeout: z.number().positive().optional().describe('Query timeout in milliseconds'),
  })
  .describe('PostgreSQL input');

const outputSchema = z
  .object({
    rows: z.array(z.record(z.unknown())).optional().describe('Query result rows'),
    rowCount: z.number().optional().describe('Number of affected rows'),
    command: z.string().optional().describe('SQL command executed'),
    fields: z.array(z.object({
      name: z.string(),
      dataTypeID: z.number(),
    })).optional().describe('Result field metadata'),
    transactionResults: z.array(z.object({
      rowCount: z.number().optional(),
      command: z.string().optional(),
    })).optional().describe('Results from each transaction statement'),
    duration: z.number().describe('Execution duration in milliseconds'),
  })
  .describe('PostgreSQL output');

const configSchema = z
  .object({
    host: z.string().describe('Database host'),
    port: z.number().int().positive().optional().describe('Database port, defaults to 5432'),
    database: z.string().describe('Database name'),
    user: z.string().optional().describe('Database user'),
    ssl: z.boolean().optional().describe('Enable SSL'),
    poolSize: z.number().int().positive().optional().describe('Connection pool size'),
  })
  .describe('PostgreSQL configuration');

const secretsSchema = z
  .object({
    password: z.string().describe('Database password'),
    sslCert: z.string().optional().describe('SSL certificate'),
  })
  .describe('PostgreSQL secrets');

export type PostgresqlInput = z.infer<typeof inputSchema>;
export type PostgresqlOutput = z.infer<typeof outputSchema>;
export type PostgresqlConfig = z.infer<typeof configSchema>;
export type PostgresqlSecrets = z.infer<typeof secretsSchema>;

export const postgresqlCapability: Capability<
  PostgresqlInput,
  PostgresqlOutput,
  PostgresqlConfig,
  PostgresqlSecrets
> = {
  metadata: {
    id: 'golden.connectors.postgresql',
    domain: 'connectors',
    version: '1.0.0',
    name: 'postgresql',
    description:
      'PostgreSQL database connector for queries, mutations, and transactions. Supports parameterized queries and connection pooling.',
    tags: ['connector', 'connectors', 'database', 'postgresql', 'sql'],
    maintainer: 'platform',
  },
  schemas: {
    input: inputSchema,
    output: outputSchema,
    config: configSchema,
    secrets: secretsSchema,
  },
  security: {
    requiredScopes: ['db:read', 'db:write'],
    dataClassification: 'CONFIDENTIAL',
    networkAccess: {
      // Dynamic: database host provided via config.host
      // Common patterns: *.rds.amazonaws.com, *.postgres.database.azure.com, *.db.ondigitalocean.com
      allowOutbound: ['*'],
    },
  },
  operations: {
    isIdempotent: false, // Depends on the SQL
    retryPolicy: { maxAttempts: 3, initialIntervalSeconds: 1, backoffCoefficient: 2 },
    errorMap: (error: unknown) => {
      if (error instanceof Error) {
        if (error.message.includes('connection')) return 'RETRYABLE';
        if (error.message.includes('timeout')) return 'RETRYABLE';
        if (error.message.includes('deadlock')) return 'RETRYABLE';
        if (error.message.includes('syntax')) return 'FATAL';
      }
      return 'FATAL';
    },
    costFactor: 'LOW',
  },
  aiHints: {
    exampleInput: {
      operation: 'query',
      sql: 'SELECT id, name, email FROM users WHERE status = $1 LIMIT $2',
      params: ['active', 10],
    },
    exampleOutput: {
      rows: [
        { id: 1, name: 'Alice', email: 'alice@example.com' },
        { id: 2, name: 'Bob', email: 'bob@example.com' },
      ],
      rowCount: 2,
      command: 'SELECT',
      fields: [
        { name: 'id', dataTypeID: 23 },
        { name: 'name', dataTypeID: 25 },
        { name: 'email', dataTypeID: 25 },
      ],
      duration: 12,
    },
    usageNotes:
      'Use parameterized queries ($1, $2, etc.) to prevent SQL injection. Use transactions for multi-statement atomic operations. Query for SELECT, execute for INSERT/UPDATE/DELETE.',
  },
  factory: (
    dag,
    context: CapabilityContext<PostgresqlConfig, PostgresqlSecrets>,
    input: PostgresqlInput
  ) => {
    // ISS-compliant types - includes withMountedSecret for secret mounting
    type DaggerSecret = unknown;
    type ContainerBuilder = {
      from(image: string): ContainerBuilder;
      withEnvVariable(key: string, value: string): ContainerBuilder;
      withMountedSecret(path: string, secret: DaggerSecret): ContainerBuilder;
      withExec(args: string[]): unknown;
    };
    type DaggerClient = {
      container(): ContainerBuilder;
      setSecret(name: string, value: string): DaggerSecret;
    };
    const d = dag as unknown as DaggerClient;

    const payload = {
      operation: input.operation,
      sql: input.sql,
      params: input.params,
      statements: input.statements,
      timeout: input.timeout,
      host: context.config.host,
      port: context.config.port ?? 5432,
      database: context.config.database,
      user: context.config.user ?? 'postgres',
      ssl: context.config.ssl ?? false,
      poolSize: context.config.poolSize ?? 10,
    };

    // Build container with mounted secrets (ISS-compliant)
    let container = d
      .container()
      .from('node:20-alpine')
      .withEnvVariable('INPUT_JSON', JSON.stringify(payload))
      .withEnvVariable('OPERATION', input.operation);

    // Mount password if provided (platform resolves to Dagger Secret)
    if (context.secretRefs.password && typeof (container as Record<string, unknown>).withMountedSecret === 'function') {
      container = container.withMountedSecret('/run/secrets/db_password', context.secretRefs.password as unknown as DaggerSecret);
    }
    if (context.secretRefs.sslCert && typeof (container as Record<string, unknown>).withMountedSecret === 'function') {
      container = container.withMountedSecret('/run/secrets/ssl_cert', context.secretRefs.sslCert as unknown as DaggerSecret);
    }

    return container.withExec([
      'sh',
      '-c',
      `
npm install --no-save pg 2>/dev/null && node -e '
const { Pool } = require("pg");
const fs = require("fs");
const input = JSON.parse(process.env.INPUT_JSON);

async function run() {
  // ISS-compliant: Read password from mounted path only
  const PASSWORD_PATH = "/run/secrets/db_password";
  let password = null;
  if (fs.existsSync(PASSWORD_PATH)) {
    password = fs.readFileSync(PASSWORD_PATH, "utf8").trim();
  }

  const pool = new Pool({
    host: input.host,
    port: input.port,
    database: input.database,
    user: input.user,
    password: password,
    ssl: input.ssl ? { rejectUnauthorized: false } : false,
    max: input.poolSize,
  });

  const startTime = Date.now();
  let result;

  try {
    switch (input.operation) {
      case "query": {
        const queryResult = await pool.query({
          text: input.sql,
          values: input.params,
          ...(input.timeout && { statement_timeout: input.timeout }),
        });
        result = {
          rows: queryResult.rows,
          rowCount: queryResult.rowCount,
          command: queryResult.command,
          fields: queryResult.fields?.map(f => ({ name: f.name, dataTypeID: f.dataTypeID })),
        };
        break;
      }

      case "execute": {
        const execResult = await pool.query({
          text: input.sql,
          values: input.params,
          ...(input.timeout && { statement_timeout: input.timeout }),
        });
        result = {
          rowCount: execResult.rowCount,
          command: execResult.command,
        };
        break;
      }

      case "transaction": {
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          const txResults = [];
          for (const stmt of input.statements || []) {
            const txResult = await client.query({
              text: stmt.sql,
              values: stmt.params,
            });
            txResults.push({
              rowCount: txResult.rowCount,
              command: txResult.command,
            });
          }
          await client.query("COMMIT");
          result = { transactionResults: txResults };
        } catch (err) {
          await client.query("ROLLBACK");
          throw err;
        } finally {
          client.release();
        }
        break;
      }

      default:
        throw new Error("Unknown operation: " + input.operation);
    }

    result.duration = Date.now() - startTime;
    process.stdout.write(JSON.stringify(result));
  } finally {
    await pool.end();
  }
}

run().catch(err => {
  console.error(JSON.stringify({ error: err.message, code: err.code }));
  process.exit(1);
});
'
        `.trim(),
    ]);
  },
};
