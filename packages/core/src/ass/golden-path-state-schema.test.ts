/**
 * packages/core/src/ass/golden-path-state-schema.test.ts
 * TDD: ASS requires a Zod stateSchema; validate GoldenPathState shape.
 */
import { describe, it, expect } from 'vitest';
import { goldenPathStateSchema } from './golden-path-state.js';

describe('goldenPathStateSchema', () => {
  it('parses a valid AIP GoldenPathState payload', () => {
    const parsed = goldenPathStateSchema.parse({
      intent: 'Do something',
      active_task_id: 'task-1',
      artifacts: {
        'cap-1': { content: 'x', type: 'CAPABILITY', status: 'DRAFT' },
      },
      reasoning_history: ['step1'],
      pending_actions: [{ type: 'APPROVAL', message: 'ok?', resolved: false }],
      trace_id: 'trace-1',
    });

    expect(parsed.active_task_id).toBe('task-1');
    expect(parsed.artifacts['cap-1'].type).toBe('CAPABILITY');
  });

  it('accepts REJECTED artifact status (AIP reconciliation)', () => {
    const parsed = goldenPathStateSchema.parse({
      intent: 'Do something',
      active_task_id: 'task-1',
      artifacts: {
        'cap-1': { content: 'x', type: 'CAPABILITY', status: 'REJECTED' },
      },
      reasoning_history: ['step1'],
      pending_actions: [{ type: 'APPROVAL', message: 'ok?', resolved: false }],
      trace_id: 'trace-1',
    });

    expect(parsed.artifacts['cap-1'].status).toBe('REJECTED');
  });

  it('rejects invalid artifact status', () => {
    expect(() =>
      goldenPathStateSchema.parse({
        intent: 'x',
        active_task_id: 't',
        artifacts: {
          bad: { content: 'x', type: 'CAPABILITY', status: 'NOPE' },
        },
        reasoning_history: [],
        pending_actions: [],
        trace_id: 'trace',
      })
    ).toThrow();
  });
});

