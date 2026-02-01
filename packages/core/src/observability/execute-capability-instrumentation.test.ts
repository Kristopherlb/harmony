/**
 * packages/core/src/observability/execute-capability-instrumentation.test.ts
 * TDD: activity wrapper adds golden-span when ctx is present.
 */
import { describe, it, expect } from 'vitest';
import { wrapExecuteDaggerCapability } from './execute-capability-instrumentation.js';

describe('wrapExecuteDaggerCapability', () => {
  it('passes through when ctx is missing', async () => {
    const handler = async (input: unknown) => ({ ok: true, input });
    const wrapped = wrapExecuteDaggerCapability(handler);
    const out = await wrapped({ capId: 'x', input: {}, runAs: 'u' });
    expect(out.ok).toBe(true);
  });

  it('calls handler and returns result when ctx is present', async () => {
    const handler = async (input: { traceId?: string }) => ({ ok: true, traceId: input.traceId });
    const wrapped = wrapExecuteDaggerCapability(handler);
    const out = await wrapped({
      capId: 'x',
      input: {},
      runAs: 'u',
      traceId: 't',
      ctx: {
        app_id: 'app',
        environment: 'dev',
        initiator_id: 'user:u',
        trace_id: 't',
        data_classification: 'PUBLIC',
        cost_center: 'CC-1',
      },
    });
    expect(out.traceId).toBe('t');
  });
});

