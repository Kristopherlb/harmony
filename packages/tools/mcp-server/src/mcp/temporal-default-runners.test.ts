/**
 * packages/tools/mcp-server/src/mcp/temporal-default-runners.test.ts
 * TDD: Temporal-backed default runners for CAPABILITY and BLUEPRINT tools.
 */
import { describe, it, expect } from 'vitest';
import { createTemporalDefaultRunners, type MinimalTemporalWorkflowClient } from './temporal-default-runners.js';

describe('createTemporalDefaultRunners', () => {
  it('starts blueprint workflow by registry workflowType and returns handle ids', async () => {
    type StartOpts = { workflowId: string; taskQueue: string; args: unknown[] };
    const started: Array<{ workflowType: string; args: unknown[]; taskQueue: string; workflowId: string }> = [];

    const fakeClient: MinimalTemporalWorkflowClient = {
      workflow: {
        start: async (workflowType: string, opts: StartOpts) => {
          started.push({ workflowType, args: opts.args, taskQueue: opts.taskQueue, workflowId: opts.workflowId });
          return { workflowId: opts.workflowId, firstExecutionRunId: 'run-1' };
        },
      },
    };

    const { blueprintRunner } = createTemporalDefaultRunners({
      temporal: { client: fakeClient, taskQueue: 'golden-tools' },
      blueprints: new Map([
        ['workflows.echo', { blueprintId: 'workflows.echo', workflowType: 'echoWorkflow' }],
      ]),
      workflowIdFactory: () => 'wf-echo-1',
      capabilityBehavior: 'start',
      memoFactory: () => ({ golden: 'memo' }),
      statusUrlFactory: (workflowId, runId) => `http://ui.local/wf/${workflowId}/${runId}`,
    });

    const out = await blueprintRunner({ id: 'workflows.echo', args: { x: 1 }, traceId: 't1' });
    expect(out.result).toEqual({ workflowId: 'wf-echo-1', runId: 'run-1', statusUrl: 'http://ui.local/wf/wf-echo-1/run-1' });
    expect(started).toHaveLength(1);
    expect(started[0]).toMatchObject({
      workflowType: 'echoWorkflow',
      taskQueue: 'golden-tools',
      args: [{ x: 1 }],
      workflowId: 'wf-echo-1',
    });
  });

  it('starts executeCapabilityWorkflow for capabilities (start behavior)', async () => {
    type StartOpts = { workflowId: string; taskQueue: string; args: unknown[] };
    const started: Array<{ workflowType: string; args: unknown[] }> = [];

    const fakeClient: MinimalTemporalWorkflowClient = {
      workflow: {
        start: async (workflowType: string, opts: StartOpts) => {
          started.push({ workflowType, args: opts.args });
          return { workflowId: opts.workflowId, firstExecutionRunId: 'run-cap-1' };
        },
      },
    };

    const { capabilityRunner } = createTemporalDefaultRunners({
      temporal: { client: fakeClient, taskQueue: 'golden-tools' },
      blueprints: new Map(),
      workflowIdFactory: () => 'wf-cap-1',
      capabilityBehavior: 'start',
      memoFactory: () => ({ golden: 'memo' }),
    });

    const out = await capabilityRunner({ id: 'golden.echo', args: { x: 7 }, traceId: 't2' });
    expect(out.result).toEqual({ workflowId: 'wf-cap-1', runId: 'run-cap-1' });
    expect(started).toHaveLength(1);
    expect(started[0]).toMatchObject({
      workflowType: 'executeCapabilityWorkflow',
      args: [{ capId: 'golden.echo', args: { x: 7 } }],
    });
  });

  it('fails fast in await mode when result does not resolve within timeout', async () => {
    type StartOpts = { workflowId: string; taskQueue: string; args: unknown[] };
    const fakeClient: MinimalTemporalWorkflowClient = {
      workflow: {
        start: async (_workflowType: string, opts: StartOpts) => {
          return {
            workflowId: opts.workflowId,
            firstExecutionRunId: 'run-slow-1',
            result: async () => await new Promise(() => {}),
          };
        },
      },
    };

    const { capabilityRunner } = createTemporalDefaultRunners({
      temporal: { client: fakeClient, taskQueue: 'golden-tools' },
      blueprints: new Map(),
      workflowIdFactory: () => 'wf-cap-slow',
      capabilityBehavior: 'await',
      capabilityAwaitTimeoutMs: 10,
      memoFactory: () => ({ golden: 'memo' }),
      statusUrlFactory: (workflowId, runId) => `http://ui.local/wf/${workflowId}/${runId}`,
    });

    await expect(capabilityRunner({ id: 'golden.echo', args: { x: 7 }, traceId: 't3' })).rejects.toMatchObject({
      message: expect.stringMatching(/WORKER_NOT_RUNNING/i),
      code: 'WORKER_NOT_RUNNING',
    });
  });
});

