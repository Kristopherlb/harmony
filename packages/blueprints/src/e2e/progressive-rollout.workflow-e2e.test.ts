/**
 * packages/blueprints/src/e2e/progressive-rollout.workflow-e2e.test.ts
 * E2E test for ProgressiveRolloutWorkflow.
 *
 * Tests the staged rollout orchestration:
 * - openfeature-provider capability
 * - auto-feature-flag capability
 * - mesh-router capability
 * - canary-analyzer capability
 *
 * Run with: pnpm run bundle-workflows && RUN_E2E=true pnpm exec vitest run src/e2e
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

describe('ProgressiveRolloutWorkflow e2e', () => {
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

  it('executes staged rollout with canary analysis', async () => {
    if (skipE2E) {
      console.log('Skipping e2e test. Set RUN_E2E=true to run.');
      return;
    }

    let stageCount = 0;

    // Mock responses for each capability
    const mockResponses: Record<string, () => unknown> = {
      'golden.flags.openfeature-provider': () => ({
        value: true,
        details: { flagKey: 'release-v2.0.0-enabled', reason: 'STATIC' },
      }),
      'golden.flags.auto-feature-flag': () => ({
        flagsUpdated: ['release-v2.0.0-enabled'],
        message: 'Flag updated',
      }),
      'golden.traffic.mesh-router': () => ({
        success: true,
        currentWeights: { stable: 100 - (stageCount * 25), canary: stageCount * 25 },
        message: 'Weights updated',
      }),
      'golden.traffic.canary-analyzer': () => {
        stageCount++;
        return {
          decision: 'PROMOTE',
          baselineMetrics: { error_rate: 0.01 },
          canaryMetrics: { error_rate: 0.012 },
          deltas: { error_rate: 0.002 },
          reason: 'Canary metrics within threshold',
        };
      },
    };

    worker = await Worker.create({
      connection: testEnv.nativeConnection,
      namespace: testEnv.options.namespace ?? 'default',
      taskQueue: 'rollout-test',
      workflowBundle: { codePath: bundlePath },
      reuseV8Context: false,
      activities: {
        async executeDaggerCapability<In, Out>(
          input: ExecuteCapabilityActivityInput<In>
        ): Promise<Out> {
          capabilityCalls.push(input as ExecuteCapabilityActivityInput<unknown>);
          const responseFactory = mockResponses[input.capId];
          if (!responseFactory) {
            throw new Error(`Unexpected capability call: ${input.capId}`);
          }
          return responseFactory() as Out;
        },
        async evaluateFlag(input: EvaluateFlagActivityInput): Promise<boolean> {
          flagCalls.push(input);
          return true;
        },
      },
    });

    const input = {
      version: 'v2.0.0',
      baselineVersion: 'v1.9.0',
      prometheusUrl: 'http://prometheus:9090',
      service: 'harmony-mcp',
      stages: [25, 50, 75, 100], // 4 stages for faster test
      analysisWindowSeconds: 1, // Minimal for testing
      useMeshRouting: true,
    };

    await worker.runUntil(async () => {
      const handle = await testEnv.client.workflow.start('progressiveRolloutWorkflow', {
        taskQueue: 'rollout-test',
        workflowId: `rollout-e2e-${Date.now()}`,
        args: [input, {}],
        memo: {
          [SECURITY_CONTEXT_MEMO_KEY]: {
            initiatorId: 'user:e2e',
            roles: ['traffic:rollout'],
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

      const result = (await handle.result()) as {
        status: string;
        finalPercentage: number;
        stageResults: unknown[];
      };

      // Verify successful promotion
      expect(result.status).toBe('PROMOTED');
      expect(result.finalPercentage).toBe(100);
      expect(result.stageResults).toHaveLength(4);
    });

    // Verify canary analyzer was called for each stage
    const analyzerCalls = capabilityCalls.filter(
      (c) => c.capId === 'golden.traffic.canary-analyzer'
    );
    expect(analyzerCalls.length).toBe(4); // One per stage
  }, 120_000);

  it('rolls back when canary analysis fails', async () => {
    if (skipE2E) {
      console.log('Skipping e2e test. Set RUN_E2E=true to run.');
      return;
    }

    capabilityCalls.length = 0; // Reset
    let callCount = 0;

    // Mock responses - canary fails on second stage
    const mockResponses: Record<string, () => unknown> = {
      'golden.flags.openfeature-provider': () => ({
        value: true,
        details: { flagKey: 'release-v2.1.0-enabled', reason: 'STATIC' },
      }),
      'golden.flags.auto-feature-flag': () => ({
        flagsUpdated: ['release-v2.1.0-enabled'],
        message: 'Flag updated',
      }),
      'golden.traffic.mesh-router': () => ({
        success: true,
        currentWeights: { stable: 75, canary: 25 },
        message: 'Weights updated',
      }),
      'golden.traffic.canary-analyzer': () => {
        callCount++;
        if (callCount >= 2) {
          // Fail on second analysis
          return {
            decision: 'ROLLBACK',
            baselineMetrics: { error_rate: 0.01 },
            canaryMetrics: { error_rate: 0.15 }, // High error rate
            deltas: { error_rate: 0.14 },
            reason: 'Error rate exceeds threshold',
          };
        }
        return {
          decision: 'PROMOTE',
          baselineMetrics: { error_rate: 0.01 },
          canaryMetrics: { error_rate: 0.012 },
          deltas: { error_rate: 0.002 },
          reason: 'Canary metrics within threshold',
        };
      },
    };

    const worker2 = await Worker.create({
      connection: testEnv.nativeConnection,
      namespace: testEnv.options.namespace ?? 'default',
      taskQueue: 'rollout-rollback-test',
      workflowBundle: { codePath: bundlePath },
      reuseV8Context: false,
      activities: {
        async executeDaggerCapability<In, Out>(
          input: ExecuteCapabilityActivityInput<In>
        ): Promise<Out> {
          capabilityCalls.push(input as ExecuteCapabilityActivityInput<unknown>);
          const responseFactory = mockResponses[input.capId];
          if (!responseFactory) {
            throw new Error(`Unexpected capability call: ${input.capId}`);
          }
          return responseFactory() as Out;
        },
        async evaluateFlag(input: EvaluateFlagActivityInput): Promise<boolean> {
          return true;
        },
      },
    });

    const input = {
      version: 'v2.1.0',
      baselineVersion: 'v2.0.0',
      prometheusUrl: 'http://prometheus:9090',
      service: 'harmony-mcp',
      stages: [25, 50], // 2 stages - should fail on second
      analysisWindowSeconds: 1,
      useMeshRouting: true,
    };

    try {
      await worker2.runUntil(async () => {
        const handle = await testEnv.client.workflow.start('progressiveRolloutWorkflow', {
          taskQueue: 'rollout-rollback-test',
          workflowId: `rollout-rollback-e2e-${Date.now()}`,
          args: [input, {}],
          memo: {
            [SECURITY_CONTEXT_MEMO_KEY]: {
              initiatorId: 'user:e2e',
              roles: ['traffic:rollout'],
              tokenRef: '',
              traceId: 'trace-e2e-rollback',
            },
            [GOLDEN_CONTEXT_MEMO_KEY]: {
              app_id: 'e2e-test',
              environment: 'test',
              initiator_id: 'user:e2e',
              trace_id: 'trace-e2e-rollback',
            },
          },
        });

        const result = (await handle.result()) as {
          status: string;
          stoppedAtPercentage: number;
          reason: string;
        };

        // Verify rollback
        expect(result.status).toBe('ROLLED_BACK');
        expect(result.stoppedAtPercentage).toBe(50);
        expect(result.reason).toContain('Error rate');
      });
    } finally {
      await worker2.shutdown();
    }
  }, 120_000);
});
