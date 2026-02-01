/**
 * packages/tools/mcp-server/src/mcp/temporal-memo.integration.test.ts
 * Integration: MCP-triggered Temporal starts include required memos so workflows execute.
 */
import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker, bundleWorkflowCode } from '@temporalio/worker';
import { createToolSurface } from './tool-surface.js';
import { createTemporalDefaultRunners, type MinimalTemporalWorkflowClient } from './temporal-default-runners.js';
import { generateToolManifestFromCapabilities } from '../manifest/capabilities.js';
import { createCapabilityRegistry } from '@golden/capabilities';
import { createBlueprintRegistry } from '@golden/blueprints';
import { GOLDEN_CONTEXT_MEMO_KEY, SECURITY_CONTEXT_MEMO_KEY } from '@golden/core/workflow';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Temporal memo propagation (integration)', () => {
  it('runs workflows.echo and executeCapabilityWorkflow successfully', async () => {
    let testEnv: TestWorkflowEnvironment | undefined;
    let lastErr: unknown;
    for (let i = 0; i < 3; i++) {
      try {
        testEnv = await TestWorkflowEnvironment.createTimeSkipping();
        break;
      } catch (e) {
        lastErr = e;
        if (String(e).includes('Address already in use')) continue;
        throw e;
      }
    }
    if (!testEnv) throw lastErr;
    const taskQueue = 'mcp-integration';

    const repoRoot = path.resolve(__dirname, '../../../../..');
    const workflowsPath = path.join(repoRoot, 'packages/blueprints/dist/src/workflows');
    const bundle = await bundleWorkflowCode({ workflowsPath, ignoreModules: [] });

    const activitiesPath = path.join(repoRoot, 'packages/blueprints/dist/src/activities/execute-capability-activity.js');
    const activitiesModule = await import(activitiesPath);

    const worker = await Worker.create({
      connection: testEnv.nativeConnection,
      namespace: testEnv.options.namespace ?? 'default',
      taskQueue,
      workflowBundle: bundle,
      reuseV8Context: false,
      activities: {
        executeDaggerCapability: activitiesModule.executeDaggerCapability,
      },
    });

    const manifest = generateToolManifestFromCapabilities({
      registry: createCapabilityRegistry(),
      generated_at: '2026-01-28T00:00:00.000Z',
      version: '1',
      includeBlueprints: true,
    });

    const blueprints = createBlueprintRegistry();
    const minimalBlueprints = new Map<string, { blueprintId: string; workflowType: string }>();
    for (const [id, entry] of blueprints.entries()) {
      minimalBlueprints.set(id, { blueprintId: entry.blueprintId, workflowType: entry.workflowType });
    }

    await worker.runUntil(async () => {
      const { capabilityRunner, blueprintRunner } = createTemporalDefaultRunners({
        temporal: {
          client: testEnv.client as unknown as MinimalTemporalWorkflowClient,
          taskQueue,
        },
        blueprints: minimalBlueprints,
        workflowIdFactory: (toolId) => `wf-${toolId}-1`,
        capabilityBehavior: 'await',
        memoFactory: ({ traceId }) => ({
          [SECURITY_CONTEXT_MEMO_KEY]: { initiatorId: 'user:test', roles: [], tokenRef: '', traceId },
          [GOLDEN_CONTEXT_MEMO_KEY]: {
            app_id: 'mcp-server',
            environment: 'test',
            initiator_id: 'user:test',
            trace_id: traceId,
            cost_center: 'CC-test',
            data_classification: 'INTERNAL',
          },
        }),
      });

      const surface = createToolSurface({
        manifest,
        traceId: () => 'trace-integration',
        capabilityRunner,
        blueprintRunner,
      });

      // BLUEPRINT: start + then verify it actually runs (no missing memo errors).
      const bpRes = await surface.callTool({ name: 'workflows.echo', arguments: { x: 5 } });
      expect(bpRes.isError).toBe(false);
      const bpStructured = bpRes.structuredContent as Record<string, unknown>;
      const bpResult = bpStructured.result as { workflowId: string };
      const bpWorkflowId = bpResult.workflowId;
      expect(bpWorkflowId).toBe('wf-workflows.echo-1');

      const bpHandle = testEnv.client.workflow.getHandle(bpWorkflowId);
      const bpOut = await bpHandle.result();
      expect(bpOut).toEqual({ y: 5 });

      // CAPABILITY: runs via executeCapabilityWorkflow (await behavior).
      const capRes = await surface.callTool({ name: 'golden.echo', arguments: { x: 9 } });
      expect(capRes.isError).toBe(false);
      const capStructured = capRes.structuredContent as Record<string, unknown>;
      expect(capStructured.result).toEqual({ y: 9 });
    });

    await testEnv.teardown();
  }, 60_000);
});

