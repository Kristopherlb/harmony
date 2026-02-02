/**
 * packages/core/src/wcs/base-blueprint.execute-by-id.test.ts
 * TDD: executeById forwards config/secretRefs into activity payload.
 * Also tests flag-aware execution (cap-{id}-enabled checks).
 */
import { describe, it, expect, vi } from 'vitest';
import { z } from '@golden/schema-registry';

// Mock Temporal workflow APIs used by BaseBlueprint.
vi.mock('@temporalio/workflow', () => {
  const state: {
    memo?: Record<string, unknown>;
    captured?: unknown;
    flagResults?: Record<string, boolean>;
    flagCalls?: Array<{ flagKey: string; defaultValue: boolean }>;
  } = { flagCalls: [] };

  return {
    workflowInfo: () => ({ memo: state.memo ?? {}, workflowId: 'wf-1' }),
    proxyActivities: <T>(_opts?: unknown) => {
      // Return both capability execution and flag evaluation activities
      return {
        executeDaggerCapability: async (input: unknown) => {
          state.captured = input;
          return { ok: true };
        },
        evaluateFlag: async (input: { flagKey: string; defaultValue: boolean }) => {
          state.flagCalls?.push(input);
          // Return configured result or default to true (enabled)
          return state.flagResults?.[input.flagKey] ?? input.defaultValue;
        },
      } as T;
    },
    uuid4: () => 'uuid-1',
    sleep: async () => {},
    __setMemo: (memo: Record<string, unknown>) => {
      state.memo = memo;
    },
    __getCaptured: () => state.captured,
    __setFlagResults: (results: Record<string, boolean>) => {
      state.flagResults = results;
    },
    __getFlagCalls: () => state.flagCalls,
    __resetFlagCalls: () => {
      state.flagCalls = [];
    },
  };
});

import {
  BaseBlueprint,
  GOLDEN_CONTEXT_MEMO_KEY,
  SECURITY_CONTEXT_MEMO_KEY,
  CapabilityDisabledError,
} from './base-blueprint.js';

class TestBlueprint extends BaseBlueprint<
  { capId: string; args: unknown; config?: unknown; secretRefs?: unknown; skipFlagCheck?: boolean },
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
      skipFlagCheck: z.boolean().optional(),
    })
    .describe('TestBlueprint input') as BaseBlueprint<
    { capId: string; args: unknown; config?: unknown; secretRefs?: unknown; skipFlagCheck?: boolean },
    unknown,
    object
  >['inputSchema'];

  readonly configSchema = z.object({});

  protected async logic(input: {
    capId: string;
    args: unknown;
    config?: unknown;
    secretRefs?: unknown;
    skipFlagCheck?: boolean;
  }): Promise<unknown> {
    return this.executeById(input.capId, input.args, {
      config: input.config,
      secretRefs: input.secretRefs,
      skipFlagCheck: input.skipFlagCheck,
    });
  }
}

// Helper to get typed mock functions
async function getWorkflowMock() {
  return (await import('@temporalio/workflow')) as unknown as {
    __setMemo: (memo: Record<string, unknown>) => void;
    __getCaptured: () => unknown;
    __setFlagResults: (results: Record<string, boolean>) => void;
    __getFlagCalls: () => Array<{ flagKey: string; defaultValue: boolean }>;
    __resetFlagCalls: () => void;
  };
}

// Helper to set up standard memo context
function setupMemo(wf: Awaited<ReturnType<typeof getWorkflowMock>>) {
  wf.__setMemo({
    [SECURITY_CONTEXT_MEMO_KEY]: { initiatorId: 'user:test', roles: [], tokenRef: 't', traceId: 'trace-1' },
    [GOLDEN_CONTEXT_MEMO_KEY]: { app_id: 'app', environment: 'test', initiator_id: 'user:test', trace_id: 'trace-1' },
  });
}

describe('BaseBlueprint.executeById', () => {
  it('includes config and secretRefs in ExecuteCapability activity payload', async () => {
    const wf = await getWorkflowMock();
    setupMemo(wf);
    wf.__resetFlagCalls();

    const b = new TestBlueprint();
    await b.main(
      {
        capId: 'golden.jira.issue.search',
        args: { jql: 'project = X' },
        config: { host: 'x', authMode: 'basic' },
        secretRefs: { jiraApiToken: 's' },
      },
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

  it('checks capability flag before execution', async () => {
    const wf = await getWorkflowMock();
    setupMemo(wf);
    wf.__resetFlagCalls();

    const b = new TestBlueprint();
    await b.main({ capId: 'golden.security.trivy', args: { target: '.' } }, {});

    const flagCalls = wf.__getFlagCalls();
    expect(flagCalls).toContainEqual(
      expect.objectContaining({
        flagKey: 'cap-golden.security.trivy-enabled',
        defaultValue: true,
      })
    );
  });

  it('throws CapabilityDisabledError when flag is false', async () => {
    const wf = await getWorkflowMock();
    setupMemo(wf);
    wf.__resetFlagCalls();
    wf.__setFlagResults({ 'cap-golden.security.trivy-enabled': false });

    const b = new TestBlueprint();

    await expect(
      b.main({ capId: 'golden.security.trivy', args: { target: '.' } }, {})
    ).rejects.toThrow(CapabilityDisabledError);
  });

  it('skips flag check for golden.flags.* capabilities', async () => {
    const wf = await getWorkflowMock();
    setupMemo(wf);
    wf.__resetFlagCalls();

    const b = new TestBlueprint();
    await b.main({ capId: 'golden.flags.openfeature-provider', args: { flagKey: 'test' } }, {});

    const flagCalls = wf.__getFlagCalls();
    // Should NOT have checked cap-golden.flags.openfeature-provider-enabled
    expect(flagCalls).not.toContainEqual(
      expect.objectContaining({ flagKey: 'cap-golden.flags.openfeature-provider-enabled' })
    );
  });

  it('skips flag check when skipFlagCheck option is true', async () => {
    const wf = await getWorkflowMock();
    setupMemo(wf);
    wf.__resetFlagCalls();

    const b = new TestBlueprint();
    await b.main(
      { capId: 'golden.security.trivy', args: { target: '.' }, skipFlagCheck: true },
      {}
    );

    const flagCalls = wf.__getFlagCalls();
    // Should NOT have checked the flag
    expect(flagCalls).not.toContainEqual(
      expect.objectContaining({ flagKey: 'cap-golden.security.trivy-enabled' })
    );
  });
});

