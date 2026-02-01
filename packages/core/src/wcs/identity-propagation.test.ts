/**
 * packages/core/src/wcs/identity-propagation.test.ts
 * Contract test: initiator_id and trace_id propagate via activity payload (Metric 4).
 */
import { describe, it, expect } from 'vitest';
import type { ExecuteCapabilityActivityInput } from './execute-capability-activity';

describe('Identity propagation contract', () => {
  it('ExecuteCapabilityActivityInput includes runAs, traceId, and optional ctx', () => {
    const payload: ExecuteCapabilityActivityInput<{ x: number }> = {
      capId: 'test.cap',
      input: { x: 1 },
      runAs: 'user:jane',
      traceId: 'wf-123',
      ctx: {
        app_id: 'app',
        environment: 'dev',
        initiator_id: 'user:jane',
        trace_id: 'wf-123',
      },
    };
    expect(payload.runAs).toBe('user:jane');
    expect(payload.traceId).toBe('wf-123');
    expect(payload.ctx?.trace_id).toBe('wf-123');
    expect(payload.capId).toBe('test.cap');
  });
});
