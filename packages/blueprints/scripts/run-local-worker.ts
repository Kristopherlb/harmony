/**
 * packages/blueprints/scripts/run-local-worker.ts
 * Local dev Temporal Worker for Persona A demo.
 *
 * Purpose:
 * - Poll a real Temporal service (docker-compose)
 * - Run bundled workflows
 * - Provide a deterministic stub for `executeDaggerCapability` so demos do not require Dagger
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NativeConnection, Worker } from '@temporalio/worker';
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
    throw new Error(`Workflow bundle missing at ${bundlePath}. Run: pnpm --filter @golden/blueprints run bundle-workflows`);
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
        // Deterministic dev stub: keep Persona A demo lightweight.
        if (input.capId === 'golden.echo') {
          const inp = input.input as unknown as { x: number };
          return { y: inp.x } as Out;
        }
        if (input.capId === 'golden.math_add') {
          const inp = input.input as unknown as { a: number; b: number };
          return { sum: inp.a + inp.b } as Out;
        }
        throw new Error(`DEV_STUB_ONLY (capId=${input.capId})`);
      },
      ...createApprovalActivities(),
    },
  });

  console.log(JSON.stringify({ ok: true, state: 'WORKER_RUNNING', address, namespace, taskQueue }));
  await worker.run();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

