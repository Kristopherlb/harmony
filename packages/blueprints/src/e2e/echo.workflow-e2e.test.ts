/**
 * packages/blueprints/src/e2e/echo.workflow-e2e.test.ts
 * Temporal e2e: run EchoWorkflow via TestWorkflowEnvironment + Worker bundle.
 * Asserts runAs and trace_id reach the activity.
 *
 * Run with: pnpm run bundle-workflows && pnpm exec vitest run src/e2e
 * Note: Vitest can make Math read-only; if you see "Cannot assign to read only property 'random'",
 * run the e2e in a clean Node process (see scripts/run-e2e.mjs) or use Temporal's recommended test runner.
 */
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SECURITY_CONTEXT_MEMO_KEY } from '@golden/core';
import type { ExecuteCapabilityActivityInput } from '@golden/core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bundlePath = path.resolve(__dirname, '../../dist/workflow-bundle.js');

// Vitest makes Math read-only when the Worker loads the workflow bundle; skip in default test run.
// To run e2e: use a separate Node process (no Vitest) that starts TestWorkflowEnvironment and asserts.
const skipE2E = true;

describe('EchoWorkflow e2e (Temporal)', () => {
  let testEnv: TestWorkflowEnvironment;
  let worker!: Worker;
  const recordedCalls: ExecuteCapabilityActivityInput<unknown>[] = [];

  beforeAll(async () => {
    if (skipE2E) return;
    if (!fs.existsSync(bundlePath)) {
      throw new Error(`Workflow bundle not found at ${bundlePath}. Run: pnpm run bundle-workflows`);
    }
    testEnv = await TestWorkflowEnvironment.createTimeSkipping();
  }, 30_000);

  afterAll(async () => {
    if (worker) await worker.shutdown();
    await testEnv?.teardown();
  });

  it('runs workflow with memo; runAs and traceId reach activity', async () => {
    if (skipE2E) return;
    const runAs = 'user:e2e';
    const traceId = 'trace-e2e-123';

    worker = await Worker.create({
      connection: testEnv.nativeConnection,
      namespace: testEnv.options.namespace ?? 'default',
      taskQueue: 'echo-test',
      workflowBundle: { codePath: bundlePath },
      reuseV8Context: false,
      activities: {
        async executeDaggerCapability<In, Out>(input: ExecuteCapabilityActivityInput<In>): Promise<Out> {
          recordedCalls.push(input as ExecuteCapabilityActivityInput<unknown>);
          const inp = input.input as { x: number };
          return { y: inp.x } as Out;
        },
      },
    });

    await worker.runUntil(async () => {
      const handle = await testEnv.client.workflow.start('echoWorkflow', {
        taskQueue: 'echo-test',
        workflowId: 'echo-e2e-' + Date.now(),
        args: [{ x: 7 }],
        memo: {
          [SECURITY_CONTEXT_MEMO_KEY]: {
            initiatorId: runAs,
            roles: [],
            tokenRef: '',
            traceId,
          },
        },
      });
      const result = await handle.result();
      expect(result).toEqual({ y: 7 });
    });

    expect(recordedCalls.length).toBeGreaterThanOrEqual(1);
    expect(recordedCalls[0].runAs).toBe(runAs);
    expect(recordedCalls[0].traceId).toBe(traceId);
  }, 60_000);
});

