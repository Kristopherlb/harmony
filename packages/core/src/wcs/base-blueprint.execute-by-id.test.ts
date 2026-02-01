/**
 * packages/core/src/wcs/base-blueprint.execute-by-id.test.ts
 * TDD: executeById forwards config/secretRefs into activity payload.
 */
import { describe, it, expect, vi } from 'vitest';
import { z } from '@golden/schema-registry';

// Mock Temporal workflow APIs used by BaseBlueprint.
vi.mock('@temporalio/workflow', () => {
  const state: { memo?: Record<string, unknown>; captured?: unknown } = {};
  return {
    workflowInfo: () => ({ memo: state.memo ?? {}, workflowId: 'wf-1' }),
    proxyActivities: () => ({
      executeDaggerCapability: async (input: unknown) => {
        state.captured = input;
        return { ok: true };
      },
    }),
    uuid4: () => 'uuid-1',
    sleep: async () => {},
    __setMemo: (memo: Record<string, unknown>) => {
      state.memo = memo;
    },
    __getCaptured: () => state.captured,
  };
});

import { BaseBlueprint, GOLDEN_CONTEXT_MEMO_KEY, SECURITY_CONTEXT_MEMO_KEY } from './base-blueprint.js';

class TestBlueprint extends BaseBlueprint<
  { capId: string; args: unknown; config?: unknown; secretRefs?: unknown },
  unknown,
  object
> {
  readonly metadata = {
    id: 'workflows.test_execute_capability',
    version: '1.0.0',
    name: 'Test Execute Capability',
    description: 'Test blueprint for executeById payload.',
    owner: 'platform',
    costCenter: 'CC-0',
    tags: ['test'],
  };

  readonly security = { requiredRoles: [], classification: 'INTERNAL' as const };

  readonly operations = {
    sla: { targetDuration: '1m', maxDuration: '5m' },
  };

  readonly inputSchema = z
    .object({
      capId: z.string(),
      args: z.unknown(),
      config: z.unknown().optional(),
      secretRefs: z.unknown().optional(),
    })
    .describe('TestBlueprint input');

  readonly configSchema = z.object({});

  protected async logic(input: { capId: string; args: unknown; config?: unknown; secretRefs?: unknown }): Promise<unknown> {
    return this.executeById(input.capId, input.args, { config: input.config, secretRefs: input.secretRefs });
  }
}

describe('BaseBlueprint.executeById', () => {
  it('includes config and secretRefs in ExecuteCapability activity payload', async () => {
    const wf = (await import('@temporalio/workflow')) as unknown as {
      __setMemo: (memo: Record<string, unknown>) => void;
      __getCaptured: () => unknown;
    };
    wf.__setMemo({
      [SECURITY_CONTEXT_MEMO_KEY]: { initiatorId: 'user:test', roles: [], tokenRef: 't', traceId: 'trace-1' },
      [GOLDEN_CONTEXT_MEMO_KEY]: { app_id: 'app', environment: 'test', initiator_id: 'user:test', trace_id: 'trace-1' },
    });

    const b = new TestBlueprint();
    await b.main(
      { capId: 'golden.jira.issue.search', args: { jql: 'project = X' }, config: { host: 'x', authMode: 'basic' }, secretRefs: { jiraApiToken: 's' } },
      {}
    );

    const captured = wf.__getCaptured();
    expect(captured).toMatchObject({
      capId: 'golden.jira.issue.search',
      input: { jql: 'project = X' },
      config: { host: 'x', authMode: 'basic' },
      secretRefs: { jiraApiToken: 's' },
    });
  });
});

