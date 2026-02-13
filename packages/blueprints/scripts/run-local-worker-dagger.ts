/**
 * packages/blueprints/scripts/run-local-worker-dagger.ts
 * Local dev Temporal Worker (runtime-true).
 *
 * Purpose:
 * - Poll a real Temporal service (docker-compose)
 * - Run bundled workflows
 * - Provide the real `executeDaggerCapability` activity (container execution via Dagger)
 *
 * Notes:
 * - Requires Docker and ENABLE_DAGGER_E2E=1 (see execute-dagger-capability.ts).
 *
 * Run:
 *   pnpm --filter @golden/blueprints run bundle-workflows
 *   ENABLE_DAGGER_E2E=1 pnpm --filter @golden/blueprints exec tsx scripts/run-local-worker-dagger.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NativeConnection, Worker } from '@temporalio/worker';
import { executeDaggerCapability } from '../src/worker/execute-dagger-capability.js';
import type { ExecuteCapabilityActivityInput } from '@golden/core';
import { createApprovalActivities } from '../src/activities/approval-activities.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, '..');
const bundlePath = path.join(packageRoot, 'dist', 'workflow-bundle.js');

function readEnv(name: string, fallback: string): string {
  const v = process.env[name];
  if (typeof v === 'string' && v.trim().length > 0) return v.trim();
  return fallback;
}

async function main(): Promise<void> {
  if (!fs.existsSync(bundlePath)) {
    throw new Error(
      `Workflow bundle missing at ${bundlePath}. Run: pnpm --filter @golden/blueprints run bundle-workflows`
    );
  }

  if (process.env.ENABLE_DAGGER_E2E !== '1') {
    throw new Error('ENABLE_DAGGER_E2E must be set to 1 for this worker (runtime-true capability execution).');
  }

  const address = readEnv('TEMPORAL_ADDRESS', 'localhost:7233');
  const namespace = readEnv('TEMPORAL_NAMESPACE', 'default');
  const taskQueue = readEnv('TEMPORAL_TASK_QUEUE', 'golden-tools');

  const connection = await NativeConnection.connect({ address });

  const worker = await Worker.create({
    connection,
    namespace,
    taskQueue,
    workflowBundle: { codePath: bundlePath },
    reuseV8Context: false,
    activities: {
      async executeDaggerCapability<In, Out>(input: ExecuteCapabilityActivityInput<In>): Promise<Out> {
        return executeDaggerCapability(input);
      },
      ...createApprovalActivities(),
    },
  });

  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ ok: true, state: 'WORKER_RUNNING', mode: 'dagger', address, namespace, taskQueue }));
  await worker.run();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

