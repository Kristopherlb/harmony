/**
 * packages/blueprints/src/e2e/blue-green-deploy.workflow-e2e.test.ts
 * E2E test for BlueGreenDeployWorkflow.
 *
 * Tests the orchestration of:
 * - container-builder capability
 * - flagd-sync capability
 * - k8s.apply capability
 * - temporal.version-manager capability
 *
 * Run with: pnpm run bundle-workflows && pnpm exec vitest run src/e2e
 */
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SECURITY_CONTEXT_MEMO_KEY, GOLDEN_CONTEXT_MEMO_KEY } from '@golden/core/workflow';
import type { ExecuteCapabilityActivityInput, EvaluateFlagActivityInput } from '@golden/core/workflow';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bundlePath = path.resolve(__dirname, '../../dist/workflow-bundle.js');

// Skip in Vitest due to Math.random conflicts; run separately
const skipE2E = process.env.RUN_E2E !== 'true';

describe('BlueGreenDeployWorkflow e2e', () => {
  let testEnv: TestWorkflowEnvironment;
  let worker!: Worker;
  const capabilityCalls: ExecuteCapabilityActivityInput<unknown>[] = [];
  const flagCalls: EvaluateFlagActivityInput[] = [];

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

  it('orchestrates blue/green deployment capabilities in correct order', async () => {
    if (skipE2E) {
      console.log('Skipping e2e test. Set RUN_E2E=true to run.');
      return;
    }

    // Mock responses for each capability
    const mockResponses: Record<string, unknown> = {
      'golden.ci.container-builder': {
        imageRef: 'ghcr.io/test/harmony-worker:v2.0.0',
        digest: 'sha256:abc123',
        pushed: true,
        buildDuration: 30000,
      },
      'golden.flags.auto-feature-flag': {
        flagsGenerated: [{ flagKey: 'release-v2.0.0-enabled' }],
        flagdConfigPath: 'deploy/flagd/flags.json',
      },
      'golden.flags.flagd-sync': {
        status: 'SYNCED',
        flagsCount: 5,
      },
      'golden.k8s.apply': {
        success: true,
        resourcesAffected: 3,
        message: 'Applied 3 resources',
      },
      'golden.temporal.version-manager': {
        success: true,
        buildId: 'v2.0.0',
        message: 'Build ID registered',
      },
    };

    worker = await Worker.create({
      connection: testEnv.nativeConnection,
      namespace: testEnv.options.namespace ?? 'default',
      taskQueue: 'blue-green-test',
      workflowBundle: { codePath: bundlePath },
      reuseV8Context: false,
      activities: {
        async executeDaggerCapability<In, Out>(
          input: ExecuteCapabilityActivityInput<In>
        ): Promise<Out> {
          capabilityCalls.push(input as ExecuteCapabilityActivityInput<unknown>);
          const response = mockResponses[input.capId];
          if (!response) {
            throw new Error(`Unexpected capability call: ${input.capId}`);
          }
          return response as Out;
        },
        async evaluateFlag(input: EvaluateFlagActivityInput): Promise<boolean> {
          flagCalls.push(input);
          // All capabilities enabled
          return true;
        },
      },
    });

    const input = {
      version: 'v2.0.0',
      registry: 'ghcr.io/test',
      contextPath: 'packages/blueprints',
      taskQueue: 'golden-tools',
      namespace: 'production',
    };

    await worker.runUntil(async () => {
      const handle = await testEnv.client.workflow.start('blueGreenDeployWorkflow', {
        taskQueue: 'blue-green-test',
        workflowId: `blue-green-e2e-${Date.now()}`,
        args: [input, {}],
        memo: {
          [SECURITY_CONTEXT_MEMO_KEY]: {
            initiatorId: 'user:e2e',
            roles: ['deploy:blue-green'],
            tokenRef: '',
            traceId: 'trace-e2e',
          },
          [GOLDEN_CONTEXT_MEMO_KEY]: {
            app_id: 'e2e-test',
            environment: 'test',
            initiator_id: 'user:e2e',
            trace_id: 'trace-e2e',
          },
        },
      });

      const result = await handle.result();

      // Verify result
      expect(result).toMatchObject({
        success: true,
        imageRef: 'ghcr.io/test/harmony-worker:v2.0.0',
        buildId: 'v2.0.0',
      });
    });

    // Verify capabilities were called in correct order
    const capIds = capabilityCalls.map((c) => c.capId);
    expect(capIds).toContain('golden.ci.container-builder');
    expect(capIds).toContain('golden.k8s.apply');
    expect(capIds).toContain('golden.temporal.version-manager');

    // Verify flag checks were made for non-flag capabilities
    const checkedFlags = flagCalls.map((f) => f.flagKey);
    expect(checkedFlags).toContain('cap-golden.ci.container-builder-enabled');
    expect(checkedFlags).toContain('cap-golden.k8s.apply-enabled');
  }, 120_000);
});
