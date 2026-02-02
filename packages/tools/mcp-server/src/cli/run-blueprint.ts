#!/usr/bin/env node
/**
 * packages/tools/mcp-server/src/cli/run-blueprint.ts
 * CLI to start a blueprint as a Temporal workflow.
 *
 * Used by:
 * - Dagger CI module (runBlueprint)
 * - Local development/testing
 * - CI/CD pipelines
 *
 * Usage:
 *   pnpm tsx packages/tools/mcp-server/src/cli/run-blueprint.ts \
 *     --blueprint=blueprints.deploy.blue-green \
 *     --input='{"version":"2.0.0","registry":"ghcr.io/org"}'
 *
 * Environment:
 *   TEMPORAL_ADDRESS - Temporal server address (default: localhost:7233)
 *   TEMPORAL_NAMESPACE - Temporal namespace (default: default)
 *   TASK_QUEUE - Task queue name (default: golden-tools)
 *   INITIATOR_ID - Initiator ID for security context (default: cli:run-blueprint)
 */
import { Client, Connection } from '@temporalio/client';
import { randomUUID } from 'crypto';
import { SECURITY_CONTEXT_MEMO_KEY, GOLDEN_CONTEXT_MEMO_KEY } from '@golden/core/workflow';
import fs from 'node:fs';
import path from 'node:path';
import { parseCliArgsFromArgv } from './run-blueprint.args.js';

/**
 * Current script path when running as CommonJS (__dirname available).
 * Returns undefined in ESM or when __dirname is not defined (caller should not auto-invoke).
 */
function getThisScriptPath(): string | undefined {
  try {
    const dir = typeof __dirname !== 'undefined' ? __dirname : '';
    if (dir) return path.resolve(path.join(dir, 'run-blueprint.js'));
  } catch {
    // __dirname not defined (e.g. ESM)
  }
  return undefined;
}

// Blueprint registry: maps blueprint ID to workflow type name
const BLUEPRINT_REGISTRY: Record<string, string> = {
  'blueprints.deploy.blue-green': 'blueGreenDeployWorkflow',
  'blueprints.traffic.progressive-rollout': 'progressiveRolloutWorkflow',
  'blueprints.ci.release-pipeline': 'releasePipelineWorkflow',
  'workflows.echo': 'echoWorkflow',
  'workflows.math-pipeline': 'mathPipelineWorkflow',
};

function printHelp(): void {
  console.log(`
run-blueprint - Start a blueprint as a Temporal workflow

Usage:
  run-blueprint --blueprint=<id> (--input='<json>' | --input-file=<path>) [options]

Options:
  --blueprint=<id>    Blueprint ID (required)
  --input='<json>'    JSON input for the blueprint (default: {})
  --input-file=<path> Read JSON input from a file (preferred for CI)
  --config='<json>'   JSON config for the blueprint (optional)
  --no-await          Don't wait for workflow completion
  --timeout=<ms>      Timeout for await in milliseconds (default: 300000)
  --help, -h          Show this help

Environment:
  TEMPORAL_ADDRESS    Temporal server (default: localhost:7233)
  TEMPORAL_NAMESPACE  Temporal namespace (default: default)
  TASK_QUEUE          Task queue (default: golden-tools)
  INITIATOR_ID        Initiator ID for auth (default: cli:run-blueprint)

Available Blueprints:
${Object.keys(BLUEPRINT_REGISTRY).map(id => `  - ${id}`).join('\n')}

Examples:
  # Run echo workflow
  run-blueprint --blueprint=workflows.echo --input='{"x":42}'

  # Run with input file
  run-blueprint --blueprint=workflows.echo --input-file=/tmp/input.json

  # Run blue/green deploy
  run-blueprint --blueprint=blueprints.deploy.blue-green \\
    --input='{"version":"2.0.0","registry":"ghcr.io/org","contextPath":"."}'

  # Start without waiting
  run-blueprint --blueprint=blueprints.ci.release-pipeline \\
    --input='{"version":"2.0.0","gitSha":"abc123","contextPath":"."}' \\
    --no-await
`);
}

async function main(): Promise<void> {
  const args = parseCliArgsFromArgv(process.argv.slice(2));
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  // Resolve workflow type from blueprint ID
  const workflowType = BLUEPRINT_REGISTRY[args.blueprint];
  if (!workflowType) {
    console.error(`Error: Unknown blueprint '${args.blueprint}'`);
    console.error('Available blueprints:');
    for (const id of Object.keys(BLUEPRINT_REGISTRY)) {
      console.error(`  - ${id}`);
    }
    process.exit(1);
  }

  // Parse input and config
  let input: unknown;
  let config: unknown = {};
  try {
    const rawInput = args.inputFile
      ? fs.readFileSync(args.inputFile, 'utf-8')
      : (args.input ?? '{}');
    input = JSON.parse(rawInput);
  } catch (e) {
    console.error(`Error: Invalid JSON input: ${e}`);
    process.exit(1);
  }
  if (args.config) {
    try {
      config = JSON.parse(args.config);
    } catch (e) {
      console.error(`Error: Invalid JSON in --config: ${e}`);
      process.exit(1);
    }
  }

  // Connect to Temporal
  const temporalAddress = process.env.TEMPORAL_ADDRESS ?? 'localhost:7233';
  const namespace = process.env.TEMPORAL_NAMESPACE ?? 'default';
  const taskQueue = process.env.TASK_QUEUE ?? 'golden-tools';
  const initiatorId = process.env.INITIATOR_ID ?? 'cli:run-blueprint';

  console.error(`[run-blueprint] Connecting to Temporal at ${temporalAddress}...`);

  const connection = await Connection.connect({ address: temporalAddress });
  const client = new Client({ connection, namespace });

  // Generate workflow ID
  const workflowId = `${args.blueprint}-${randomUUID().slice(0, 8)}`;
  const traceId = `trace-${randomUUID().slice(0, 8)}`;

  // Build memo with security and golden context
  const memo = {
    [SECURITY_CONTEXT_MEMO_KEY]: {
      initiatorId,
      roles: ['cli:admin'],
      tokenRef: '',
      traceId,
    },
    [GOLDEN_CONTEXT_MEMO_KEY]: {
      app_id: 'run-blueprint-cli',
      environment: process.env.NODE_ENV ?? 'development',
      initiator_id: initiatorId,
      trace_id: traceId,
    },
  };

  console.error(`[run-blueprint] Starting workflow:`);
  console.error(`  Blueprint: ${args.blueprint}`);
  console.error(`  Workflow Type: ${workflowType}`);
  console.error(`  Workflow ID: ${workflowId}`);
  console.error(`  Task Queue: ${taskQueue}`);

  // Start the workflow
  const handle = await client.workflow.start(workflowType, {
    taskQueue,
    workflowId,
    args: [input, config],
    memo,
  });

  console.error(`[run-blueprint] Workflow started: ${handle.workflowId}`);
  console.error(`[run-blueprint] Run ID: ${handle.firstExecutionRunId}`);

  if (args.await) {
    console.error(`[run-blueprint] Waiting for result (timeout: ${args.timeoutMs}ms)...`);

    try {
      const result = await Promise.race([
        handle.result(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout waiting for workflow result')), args.timeoutMs)
        ),
      ]);

      // Output result as JSON to stdout (for Dagger to capture)
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      console.error(`[run-blueprint] Error: ${error}`);
      // Still output partial info
      console.log(JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
        workflowId: handle.workflowId,
        runId: handle.firstExecutionRunId,
      }));
      process.exit(1);
    }
  } else {
    // Just output workflow info
    console.log(JSON.stringify({
      workflowId: handle.workflowId,
      runId: handle.firstExecutionRunId,
      status: 'started',
    }));
  }

  await connection.close();
}

function isInvokedAsScript(): boolean {
  const argv1 = process.argv[1];
  if (!argv1) return true;
  const scriptPath = path.resolve(argv1);
  const thisPath = getThisScriptPath();
  if (!thisPath) return false;
  return path.normalize(scriptPath) === path.normalize(thisPath);
}

if (isInvokedAsScript()) {
  main().catch((err) => {
    console.error('[run-blueprint] Fatal error:', err);
    process.exit(1);
  });
}
