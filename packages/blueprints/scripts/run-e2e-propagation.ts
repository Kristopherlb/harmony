/**
 * packages/blueprints/scripts/run-e2e-propagation.ts
 * Temporal e2e runner (clean Node process, not Vitest).
 *
 * Purpose: validate workflow bundling + Worker wiring + propagation of runAs/traceId/ctx.trace_id
 * WITHOUT requiring a Dagger engine. Activity return is an explicit stub.
 */
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import type { ExecuteCapabilityActivityInput, GoldenContext } from '@golden/core';
import { SECURITY_CONTEXT_MEMO_KEY, GOLDEN_CONTEXT_MEMO_KEY } from '@golden/core/workflow';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, '..');
const bundlePath = path.join(packageRoot, 'dist', 'workflow-bundle.js');

async function main() {
  if (!fs.existsSync(bundlePath)) {
    throw new Error(`Workflow bundle missing at ${bundlePath}. Run: pnpm run bundle-workflows`);
  }

  const recordedCalls: ExecuteCapabilityActivityInput<unknown>[] = [];
  const runAs = 'user:e2e';
  const traceId = 'trace-e2e-123';
  const ctx: GoldenContext = {
    app_id: 'e2e-app',
    environment: 'test',
    initiator_id: runAs,
    trace_id: traceId,
    data_classification: 'PUBLIC',
    cost_center: 'CC-e2e',
  };

  const testEnv = await TestWorkflowEnvironment.createTimeSkipping();
  let worker: Worker | undefined;
  try {
    worker = await Worker.create({
      connection: testEnv.nativeConnection,
      namespace: testEnv.options.namespace ?? 'default',
      taskQueue: 'echo-test',
      workflowBundle: { codePath: bundlePath },
      reuseV8Context: false,
      activities: {
        async executeDaggerCapability<In, Out>(input: ExecuteCapabilityActivityInput<In>): Promise<Out> {
          recordedCalls.push(input as ExecuteCapabilityActivityInput<unknown>);
          // Explicit stub: the Dagger-backed path is tested via `blueprints:e2e-dagger`.
          const inp = input.input as unknown as { x: number };
          return { y: inp.x } as Out;
        },
      },
    });

    await worker.runUntil(async () => {
      const handle = await testEnv.client.workflow.start('echoWorkflow', {
        taskQueue: 'echo-test',
        workflowId: `echo-e2e-${Date.now()}`,
        args: [{ x: 7 }],
        memo: {
          [SECURITY_CONTEXT_MEMO_KEY]: {
            initiatorId: runAs,
            roles: [],
            tokenRef: '',
            traceId,
          },
          [GOLDEN_CONTEXT_MEMO_KEY]: ctx,
        },
      });
      const result = await handle.result();
      assert.deepEqual(result, { y: 7 });
    });

    assert.ok(recordedCalls.length >= 1);
    assert.equal(recordedCalls[0].runAs, runAs);
    assert.equal(recordedCalls[0].traceId, traceId);
    assert.equal(recordedCalls[0].ctx?.trace_id, traceId);
  } finally {
    await testEnv.teardown();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

