/**
 * packages/core/src/ass/guardrails.test.ts
 * TDD: iteration and RESTRICTED tool guardrails (ASS 2.3).
 */
import { describe, it, expect } from 'vitest';
import {
  checkIterationGuardrail,
  checkTokenGuardrail,
  checkRestrictedToolGuardrail,
} from './guardrails';

describe('checkIterationGuardrail', () => {
  it('passes when under max_iterations', () => {
    expect(checkIterationGuardrail(2, { max_iterations: 5 })).toEqual({
      pass: true,
    });
  });

  it('fails when max_iterations exceeded', () => {
    expect(checkIterationGuardrail(5, { max_iterations: 5 })).toEqual({
      pass: false,
      reason: 'MAX_ITERATIONS_EXCEEDED',
    });
  });
});

describe('checkTokenGuardrail', () => {
  it('passes when token_limit is unset', () => {
    expect(checkTokenGuardrail(10_000, { max_iterations: 5 })).toEqual({ pass: true });
  });

  it('passes when under token_limit', () => {
    expect(checkTokenGuardrail(100, { max_iterations: 5, token_limit: 1000 })).toEqual({ pass: true });
  });

  it('fails when token_limit exceeded', () => {
    expect(checkTokenGuardrail(1000, { max_iterations: 5, token_limit: 1000 })).toEqual({
      pass: false,
      reason: 'TOKEN_LIMIT_EXCEEDED',
    });
  });
});

describe('checkRestrictedToolGuardrail', () => {
  it('passes for PUBLIC', () => {
    expect(checkRestrictedToolGuardrail('PUBLIC')).toEqual({ pass: true });
  });

  it('fails for RESTRICTED and returns HITL reason', () => {
    expect(checkRestrictedToolGuardrail('RESTRICTED')).toEqual({
      pass: false,
      reason: 'RESTRICTED_TOOL_REQUIRES_APPROVAL',
    });
  });
});
