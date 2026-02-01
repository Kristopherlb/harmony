/**
 * packages/core/src/ass/golden-path-state.test.ts
 * TDD: GoldenPathState shape and usage (AIP).
 */
import { describe, it, expect } from 'vitest';
import { type GoldenPathStateType } from './golden-path-state';

describe('GoldenPathState', () => {
  it('allows constructing state with required fields', () => {
    const state: GoldenPathStateType = {
      intent: 'Create a capability',
      active_task_id: 'task-1',
      artifacts: {},
      reasoning_history: [],
      pending_actions: [],
      trace_id: 'trace-abc',
    };
    expect(state.intent).toBe('Create a capability');
    expect(state.trace_id).toBe('trace-abc');
  });

  it('allows artifacts with DRAFT status', () => {
    const state: GoldenPathStateType = {
      intent: 'Build',
      active_task_id: 't1',
      artifacts: {
        'my-cap': {
          content: 'code',
          type: 'CAPABILITY',
          status: 'DRAFT',
        },
      },
      reasoning_history: [],
      pending_actions: [],
      trace_id: 't',
    };
    expect(state.artifacts['my-cap'].status).toBe('DRAFT');
  });

  it('allows pending_actions for HITL', () => {
    const state: GoldenPathStateType = {
      intent: 'x',
      active_task_id: 't1',
      artifacts: {},
      reasoning_history: [],
      pending_actions: [
        { type: 'APPROVAL', message: 'Approve?', resolved: false },
      ],
      trace_id: 't',
    };
    expect(state.pending_actions).toHaveLength(1);
    expect(state.pending_actions[0].type).toBe('APPROVAL');
  });
});
