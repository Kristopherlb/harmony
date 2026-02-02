/**
 * packages/blueprints/src/e2e/dogfooding.blue-green-deploy.workflow-e2e.test.ts
 *
 * Purpose:
 * - Validate Harmony can "dogfood" a deploy using its own blueprint + capabilities.
 * - Specifically: BlueGreenDeployWorkflow drives k8s.apply using repo manifests + substitutions.
 *
 * Run with:
 *   pnpm --filter @golden/blueprints run bundle-workflows
 *   RUN_E2E=true pnpm -w vitest run packages/blueprints/src/e2e/dogfooding.blue-green-deploy.workflow-e2e.test.ts
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

const skipE2E = process.env.RUN_E2E !== 'true';

describe('Dogfooding: blue/green deploy (manifests + substitutions)', () => {
  let testEnv: TestWorkflowEnvironment;
  let worker!: Worker;
  const capabilityCalls: ExecuteCapabilityActivityInput<unknown>[] = [];
  const flagCalls: EvaluateFlagActivityInput[] = [];

  beforeAll(async () => {
    if (skipE2E) return;
    if (!fs.existsSync(bundlePath)) {
      throw new Error(`Workflow bundle not found at ${bundlePath}. Run: pnpm --filter @golden/blueprints run bundle-workflows`);
    }
    testEnv = await TestWorkflowEnvironment.createTimeSkipping();
  }, 30_000);

  afterAll(async () => {
    if (worker) {
      try {
        await worker.shutdown();
      } catch {
        // Purpose: avoid failing teardown if the worker already stopped during runUntil().
      }
    }
    await testEnv?.teardown();
  });

  it('passes deploy/k8s/workers path + IMAGE_REF/BUILD_ID substitutions into k8s.apply', async () => {
    if (skipE2E) return;

    const mockResponses: Record<string, unknown> = {
      'golden.ci.container-builder': {
        imageRef: 'ghcr.io/test/harmony-worker:v2.0.0',
        digest: 'sha256:abc123',
        pushed: true,
        buildDuration: 30_000,
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
        resourcesAffected: 1,
        message: 'Applied 1 resources',
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
      taskQueue: 'dogfood-blue-green-test',
      workflowBundle: { codePath: bundlePath },
      reuseV8Context: false,
      activities: {
        async executeDaggerCapability<In, Out>(
          input: ExecuteCapabilityActivityInput<In>
        ): Promise<Out> {
          capabilityCalls.push(input as ExecuteCapabilityActivityInput<unknown>);
          const response = mockResponses[input.capId];
          if (!response) throw new Error(`Unexpected capability call: ${input.capId}`);
          return response as Out;
        },
        async evaluateFlag(input: EvaluateFlagActivityInput): Promise<boolean> {
          flagCalls.push(input);
          return true;
        },
      },
    });

    const input = {
      version: 'v2.0.0',
      registry: 'ghcr.io/test',
      contextPath: 'packages/blueprints',
      taskQueue: 'golden-tools',
      namespace: 'default',
      kubeconfigSecretRef: '/artifacts/dogfood/public/secrets/kubeconfig',
    };

    await worker.runUntil(async () => {
      const handle = await testEnv.client.workflow.start('blueGreenDeployWorkflow', {
        taskQueue: 'dogfood-blue-green-test',
        workflowId: `dogfood-blue-green-e2e-${Date.now()}`,
        args: [input, {}],
        memo: {
          [SECURITY_CONTEXT_MEMO_KEY]: {
            initiatorId: 'user:dogfood',
            roles: ['deploy:blue-green'],
            tokenRef: '',
            traceId: 'trace-dogfood',
          },
          [GOLDEN_CONTEXT_MEMO_KEY]: {
            app_id: 'dogfood-test',
            environment: 'test',
            initiator_id: 'user:dogfood',
            trace_id: 'trace-dogfood',
          },
        },
      });

      const result = await handle.result();
      expect(result).toMatchObject({
        success: true,
        buildId: 'v2.0.0',
      });
    });

    const k8sCall = capabilityCalls.find((c) => c.capId === 'golden.k8s.apply');
    expect(k8sCall).toBeTruthy();

    const k8sInput = (k8sCall as ExecuteCapabilityActivityInput<unknown>).input as unknown as {
      operation: string;
      manifestPath?: string;
      substitutions?: Record<string, string>;
      namespace?: string;
    };

    expect(k8sInput.operation).toBe('apply');
    expect(k8sInput.manifestPath).toBe('deploy/k8s/workers');
    expect(k8sInput.substitutions?.BUILD_ID).toBe('v2.0.0');
    expect(k8sInput.substitutions?.IMAGE_REF).toBe('ghcr.io/test/harmony-worker:v2.0.0');
    expect(k8sInput.substitutions?.IMAGE_TAG).toBe('v2.0.0');

    const k8sSecretRefs = (k8sCall as ExecuteCapabilityActivityInput<unknown>).secretRefs as unknown as
      | { kubeconfig?: string }
      | undefined;
    expect(k8sSecretRefs?.kubeconfig).toBe('/artifacts/dogfood/public/secrets/kubeconfig');

    const checkedFlags = flagCalls.map((f) => f.flagKey);
    expect(checkedFlags).toContain('cap-golden.k8s.apply-enabled');
    expect(checkedFlags).toContain('cap-golden.temporal.version-manager-enabled');
  }, 120_000);
});

