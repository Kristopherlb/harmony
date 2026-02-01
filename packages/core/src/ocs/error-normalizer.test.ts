/**
 * packages/core/src/ocs/error-normalizer.test.ts
 * TDD: ErrorNormalizer maps errors to category and retry hint.
 */
import { describe, it, expect } from 'vitest';
import { normalizeError, type ErrorCategory } from './error-normalizer';

describe('normalizeError', () => {
  it('maps HTTP 429 to RATE_LIMIT and retryable true', () => {
    const err = Object.assign(new Error('Too Many Requests'), {
      statusCode: 429,
      code: 'RateLimitExceeded',
    });
    const out = normalizeError(err);
    expect(out.category).toBe('RATE_LIMIT');
    expect(out.retryable).toBe(true);
  });

  it('maps HTTP 401 to AUTH_FAILURE and retryable false', () => {
    const err = Object.assign(new Error('Unauthorized'), { statusCode: 401 });
    const out = normalizeError(err);
    expect(out.category).toBe('AUTH_FAILURE');
    expect(out.retryable).toBe(false);
  });

  it('maps HTTP 503 to RETRYABLE and retryable true', () => {
    const err = Object.assign(new Error('Service Unavailable'), {
      statusCode: 503,
    });
    const out = normalizeError(err);
    expect(out.category).toBe('RETRYABLE');
    expect(out.retryable).toBe(true);
  });

  it('uses capability errorMap when provided (no statusCode path)', () => {
    const err = new Error('custom application error');
    const errorMap = (): ErrorCategory => 'FATAL';
    const out = normalizeError(err, errorMap);
    expect(out.category).toBe('FATAL');
    expect(out.retryable).toBe(false);
  });

  it('returns consistent message and originalCode for logging', () => {
    const err = Object.assign(new Error('Conflict'), {
      statusCode: 409,
      code: 'Conflict',
    });
    const out = normalizeError(err);
    expect(out.message).toBe('Conflict');
    expect(out.originalCode).toBe(409);
  });

  it('maps unknown errors to FATAL when no errorMap and no regex match', () => {
    const err = new Error('Something weird');
    const out = normalizeError(err);
    expect(out.category).toBe('FATAL');
    expect(out.retryable).toBe(false);
  });

  it('regex fallback: "rate limit" message maps to RATE_LIMIT', () => {
    const err = new Error('Rate limit exceeded. Try again later.');
    const out = normalizeError(err);
    expect(out.category).toBe('RATE_LIMIT');
    expect(out.retryable).toBe(true);
  });

  it('regex fallback: "unauthorized" message maps to AUTH_FAILURE', () => {
    const err = new Error('Unauthorized access denied');
    const out = normalizeError(err);
    expect(out.category).toBe('AUTH_FAILURE');
    expect(out.retryable).toBe(false);
  });
});
