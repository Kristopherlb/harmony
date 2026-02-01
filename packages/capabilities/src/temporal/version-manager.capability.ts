/**
 * packages/capabilities/src/temporal/version-manager.capability.ts
 * Temporal Version Manager Capability (OCS-001 Commander Pattern)
 *
 * Manages Temporal Worker Build IDs for blue/green deployments.
 * Supports registering versions, querying active executions, and waiting for drain.
 */
import { z } from '@golden/schema-registry';
import type { Capability, CapabilityContext } from '@golden/core';

const operationSchema = z.enum([
    'registerBuildAsDefault',  // Set new Build ID as default
    'getActiveExecutions',     // Query active workflows on a Build ID
    'waitForDrain',            // Wait for Build ID to have 0 active executions
    'listBuildIds',            // List all registered Build IDs
]).describe('Temporal version manager operation');

const inputSchema = z
    .object({
        operation: operationSchema,
        buildId: z.string().describe('Temporal Worker Build ID'),
        taskQueue: z.string().describe('Temporal task queue name'),
        timeoutSeconds: z.number().positive().optional().describe('Timeout for drain wait operations'),
        pollIntervalSeconds: z.number().positive().optional().describe('Poll interval for drain wait'),
    })
    .describe('Temporal Version Manager input');

const buildIdInfoSchema = z.object({
    buildId: z.string().describe('Build ID'),
    isDefault: z.boolean().describe('Whether this is the default Build ID'),
    activeExecutions: z.number().describe('Number of active executions'),
    registeredAt: z.string().optional().describe('When the Build ID was registered'),
});

const outputSchema = z
    .object({
        success: z.boolean().describe('Whether the operation succeeded'),
        buildId: z.string().describe('The Build ID operated on'),
        operation: operationSchema.describe('Operation performed'),
        activeExecutions: z.number().optional().describe('Current active executions count'),
        buildIds: z.array(buildIdInfoSchema).optional().describe('List of all Build IDs'),
        message: z.string().describe('Human-readable result message'),
        drainDurationMs: z.number().optional().describe('Time taken to drain (for waitForDrain)'),
    })
    .describe('Temporal Version Manager output');

const configSchema = z
    .object({
        temporalAddress: z.string().optional().describe('Temporal server address'),
        temporalNamespace: z.string().optional().describe('Temporal namespace'),
        defaultTimeoutSeconds: z.number().positive().optional().describe('Default timeout for operations'),
    })
    .describe('Temporal Version Manager configuration');

const secretsSchema = z
    .object({
        temporalApiKey: z.string().optional().describe('Temporal Cloud API key'),
        temporalCertPath: z.string().optional().describe('Path to mTLS certificate'),
        temporalKeyPath: z.string().optional().describe('Path to mTLS key'),
    })
    .describe('Temporal Version Manager secrets');

export type TemporalVersionManagerInput = z.infer<typeof inputSchema>;
export type TemporalVersionManagerOutput = z.infer<typeof outputSchema>;
export type TemporalVersionManagerConfig = z.infer<typeof configSchema>;
export type TemporalVersionManagerSecrets = z.infer<typeof secretsSchema>;

export const temporalVersionManagerCapability: Capability<
    TemporalVersionManagerInput,
    TemporalVersionManagerOutput,
    TemporalVersionManagerConfig,
    TemporalVersionManagerSecrets
> = {
    metadata: {
        id: 'golden.temporal.version-manager',
        version: '1.0.0',
        name: 'temporalVersionManager',
        description:
            'Manage Temporal Worker Build IDs for blue/green deployments. Register versions, query active executions, and wait for drain to ensure zero-downtime deployments.',
        tags: ['commander', 'temporal', 'deployment', 'versioning'],
        maintainer: 'platform',
    },
    schemas: {
        input: inputSchema,
        output: outputSchema,
        config: configSchema,
        secrets: secretsSchema,
    },
    security: {
        requiredScopes: ['temporal:admin'],
        dataClassification: 'INTERNAL',
        networkAccess: {
            allowOutbound: ['temporal:7233', '*.tmprl.cloud'],
        },
    },
    operations: {
        isIdempotent: true,
        retryPolicy: { maxAttempts: 3, initialIntervalSeconds: 2, backoffCoefficient: 2 },
        errorMap: (error: unknown) => {
            if (error instanceof Error) {
                if (error.message.includes('connection')) return 'RETRYABLE';
                if (error.message.includes('timeout')) return 'RETRYABLE';
                if (error.message.includes('not found')) return 'FATAL';
                if (error.message.includes('unauthorized')) return 'FATAL';
            }
            return 'FATAL';
        },
        costFactor: 'LOW',
    },
    aiHints: {
        exampleInput: {
            operation: 'registerBuildAsDefault',
            buildId: 'v2.0.0',
            taskQueue: 'golden-tools',
        },
        exampleOutput: {
            success: true,
            buildId: 'v2.0.0',
            operation: 'registerBuildAsDefault',
            message: 'Build ID v2.0.0 registered as default for task queue golden-tools',
        },
        usageNotes:
            'Use registerBuildAsDefault after deploying new workers. Use waitForDrain before decommissioning old workers to ensure zero interrupted workflows. Poll interval defaults to 10 seconds.',
    },
    factory: (
        dag,
        context: CapabilityContext<TemporalVersionManagerConfig, TemporalVersionManagerSecrets>,
        input: TemporalVersionManagerInput
    ) => {
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

        const temporalAddress = context.config.temporalAddress ?? 'temporal:7233';
        const temporalNamespace = context.config.temporalNamespace ?? 'default';
        const timeoutSeconds = input.timeoutSeconds ?? context.config.defaultTimeoutSeconds ?? 600;
        const pollIntervalSeconds = input.pollIntervalSeconds ?? 10;
        const taskQueue = input.taskQueue || 'golden-tools';

        const payload = {
            operation: input.operation,
            buildId: input.buildId,
            taskQueue,
            timeoutSeconds,
            pollIntervalSeconds,
            temporalAddress,
            temporalNamespace,
        };

        let container = d
            .container()
            .from('node:20-alpine')
            .withEnvVariable('INPUT_JSON', JSON.stringify(payload))
            .withEnvVariable('OPERATION', input.operation)
            .withEnvVariable('BUILD_ID', input.buildId)
            .withEnvVariable('TASK_QUEUE', input.taskQueue)
            .withEnvVariable('TEMPORAL_ADDRESS', temporalAddress)
            .withEnvVariable('TEMPORAL_NAMESPACE', temporalNamespace);

        // Mount secrets if provided (ISS-compliant)
        if (context.secretRefs.temporalApiKey) {
            container = container.withMountedSecret(
                '/run/secrets/temporal_api_key',
                context.secretRefs.temporalApiKey as unknown as DaggerSecret
            );
        }

        return container.withExec([
            'sh',
            '-c',
            `
npm install --no-save @temporalio/client 2>/dev/null && node -e '
const { Client, Connection } = require("@temporalio/client");

const input = JSON.parse(process.env.INPUT_JSON);
const fs = require("fs");

async function run() {
  const apiKey = fs.existsSync("/run/secrets/temporal_api_key")
    ? fs.readFileSync("/run/secrets/temporal_api_key", "utf8").trim()
    : null;

  const connectionOptions = {
    address: input.temporalAddress,
  };

  if (apiKey) {
    connectionOptions.metadata = { "temporal-namespace": input.temporalNamespace };
    connectionOptions.apiKey = apiKey;
  }

  const connection = await Connection.connect(connectionOptions);
  const client = new Client({ connection, namespace: input.temporalNamespace });

  const taskQueueClient = client.taskQueue;
  let result;

  switch (input.operation) {
    case "registerBuildAsDefault": {
      await taskQueueClient.updateBuildIdCompatibility(input.taskQueue, {
        operation: "addNewIdInNewDefaultSet",
        buildId: input.buildId,
      });
      result = {
        success: true,
        buildId: input.buildId,
        operation: input.operation,
        message: \`Build ID \${input.buildId} registered as default for task queue \${input.taskQueue}\`,
      };
      break;
    }

    case "getActiveExecutions": {
      const query = \`TaskQueue = "\${input.taskQueue}" AND BuildIds INCLUDES "\${input.buildId}" AND ExecutionStatus = "Running"\`;
      const count = await client.workflow.count({ query });
      result = {
        success: true,
        buildId: input.buildId,
        operation: input.operation,
        activeExecutions: Number(count.count),
        message: \`Found \${count.count} active executions for Build ID \${input.buildId}\`,
      };
      break;
    }

    case "waitForDrain": {
      const startTime = Date.now();
      const timeoutMs = input.timeoutSeconds * 1000;
      const pollIntervalMs = input.pollIntervalSeconds * 1000;
      let activeCount = 1;

      while (activeCount > 0) {
        if (Date.now() - startTime > timeoutMs) {
          throw new Error(\`Timeout waiting for Build ID \${input.buildId} to drain. Active: \${activeCount}\`);
        }
        const query = \`TaskQueue = "\${input.taskQueue}" AND BuildIds INCLUDES "\${input.buildId}" AND ExecutionStatus = "Running"\`;
        const count = await client.workflow.count({ query });
        activeCount = Number(count.count);
        if (activeCount > 0) {
          await new Promise(r => setTimeout(r, pollIntervalMs));
        }
      }

      result = {
        success: true,
        buildId: input.buildId,
        operation: input.operation,
        activeExecutions: 0,
        drainDurationMs: Date.now() - startTime,
        message: \`Build ID \${input.buildId} fully drained in \${Date.now() - startTime}ms\`,
      };
      break;
    }

    case "listBuildIds": {
      const reachability = await taskQueueClient.getTaskQueueCompatibility(input.taskQueue, {});
      const buildIds = reachability.buildIdReachability?.map(r => ({
        buildId: r.buildId,
        isDefault: false,
        activeExecutions: 0,
      })) || [];
      result = {
        success: true,
        buildId: input.buildId,
        operation: input.operation,
        buildIds,
        message: \`Found \${buildIds.length} Build IDs for task queue \${input.taskQueue}\`,
      };
      break;
    }

    default:
      throw new Error(\`Unknown operation: \${input.operation}\`);
  }

  console.log(JSON.stringify(result));
  await connection.close();
}

run().catch(err => {
  console.log(JSON.stringify({
    success: false,
    buildId: input.buildId,
    operation: input.operation,
    message: \`Error: \${err.message}\`,
  }));
  process.exit(1);
});
'
        `.trim(),
        ]);
    },
};
