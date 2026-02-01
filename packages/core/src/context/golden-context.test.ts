/**
 * packages/core/src/context/golden-context.test.ts
 * TDD: GoldenContext validation and parsing.
 */
import { describe, it, expect } from 'vitest';
import { parseGoldenContext } from './golden-context';

describe('GoldenContext', () => {
  const validContext: unknown = {
    app_id: 'test-app',
    environment: 'dev',
    initiator_id: 'user:jane',
    trace_id: 'trace-123',
  };

  it('parses valid context with required fields only', () => {
    const result = parseGoldenContext(validContext);
    expect(result).toEqual({
      app_id: 'test-app',
      environment: 'dev',
      initiator_id: 'user:jane',
      trace_id: 'trace-123',
    });
  });

  it('parses valid context with optional cost_center and data_classification', () => {
    const withOptional = {
      ...validContext,
      cost_center: 'CC-1024',
      data_classification: 'INTERNAL' as const,
    };
    const result = parseGoldenContext(withOptional);
    expect(result.cost_center).toBe('CC-1024');
    expect(result.data_classification).toBe('INTERNAL');
  });

  it('accepts all valid data_classification values', () => {
    const levels = ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'] as const;
    for (const level of levels) {
      const result = parseGoldenContext({
        ...validContext,
        data_classification: level,
      });
      expect(result.data_classification).toBe(level);
    }
  });

  it('throws when app_id is missing', () => {
    const invalid = { ...validContext, app_id: undefined };
    expect(() => parseGoldenContext(invalid)).toThrow();
  });

  it('throws when initiator_id is missing', () => {
    const invalid = { ...validContext, initiator_id: undefined };
    expect(() => parseGoldenContext(invalid)).toThrow();
  });

  it('throws when trace_id is missing', () => {
    const invalid = { ...validContext, trace_id: undefined };
    expect(() => parseGoldenContext(invalid)).toThrow();
  });

  it('throws when environment is missing', () => {
    const invalid = { ...validContext, environment: undefined };
    expect(() => parseGoldenContext(invalid)).toThrow();
  });

  it('throws when data_classification is invalid', () => {
    expect(() =>
      parseGoldenContext({
        ...validContext,
        data_classification: 'INVALID',
      })
    ).toThrow();
  });

  it('strips unknown extra fields', () => {
    const withExtra = { ...validContext, extra: 'ignored' };
    const result = parseGoldenContext(withExtra);
    expect(result).not.toHaveProperty('extra');
  });
});
