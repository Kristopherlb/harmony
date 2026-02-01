/**
 * packages/tools/mcp-server/src/mcp/temporal-default-runners.test.ts
 * TDD: Temporal-backed default runners for CAPABILITY and BLUEPRINT tools.
 */
import { describe, it, expect } from 'vitest';
import { createTemporalDefaultRunners } from './temporal-default-runners.js';

describe('createTemporalDefaultRunners', () => {
  it('starts blueprint workflow by registry workflowType and returns handle ids', async () => {
    const started: Array<{ workflowType: string; args: unknown[]; taskQueue: string; workflowId: string }> = [];

    const fakeClient = {
      workflow: {
        start: async (workflowType: string, opts: any) => {
          started.push({ workflowType, args: opts.args, taskQueue: opts.taskQueue, workflowId: opts.workflowId });
          return { workflowId: opts.workflowId, firstExecutionRunId: 'run-1' };
        },
      },
    };

    const { blueprintRunner } = createTemporalDefaultRunners({
      temporal: { client: fakeClient as any, taskQueue: 'golden-tools' },
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
    const started: Array<{ workflowType: string; args: unknown[] }> = [];

    const fakeClient = {
      workflow: {
        start: async (workflowType: string, opts: any) => {
          started.push({ workflowType, args: opts.args });
          return { workflowId: opts.workflowId, firstExecutionRunId: 'run-cap-1' };
        },
      },
    };

    const { capabilityRunner } = createTemporalDefaultRunners({
      temporal: { client: fakeClient as any, taskQueue: 'golden-tools' },
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
});

