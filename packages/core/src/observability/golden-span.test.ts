/**
 * packages/core/src/observability/golden-span.test.ts
 * TDD: withGoldenSpan should prefer startActiveSpan for proper parenting.
 */
import { describe, expect, it, vi } from 'vitest';
import type { GoldenContext } from '../context/golden-context.js';

const ctx: GoldenContext = {
  app_id: 'app',
  environment: 'test',
  initiator_id: 'user:test',
  trace_id: 'trace-test',
  data_classification: 'INTERNAL',
  cost_center: 'CC-1',
};

describe('withGoldenSpan', () => {
  it('prefers tracer.startActiveSpan when available', async () => {
    vi.resetModules();
    vi.doMock('@opentelemetry/api', () => {
      const span = {
        setStatus: vi.fn(),
        recordException: vi.fn(),
        end: vi.fn(),
      };
      const startActiveSpan = vi.fn((_name: string, _opts: unknown, fn: (s: unknown) => unknown) => fn(span));
      const startSpan = vi.fn(() => span);
      const getTracer = vi.fn(() => ({ startActiveSpan, startSpan }));
      return {
        trace: { getTracer },
        SpanStatusCode: { OK: 1, ERROR: 2 },
        __mocks: { startActiveSpan, startSpan },
      };
    });

    const { withGoldenSpan } = await import('./golden-span.js');
    const { __mocks } = await import('@opentelemetry/api');

    await expect(
      withGoldenSpan('test.span', ctx, 'REASONER', async () => 'ok')
    ).resolves.toBe('ok');

    expect((__mocks as any).startActiveSpan).toHaveBeenCalledTimes(1);
    expect((__mocks as any).startSpan).not.toHaveBeenCalled();
  });

  it('falls back to tracer.startSpan when startActiveSpan is missing', async () => {
    vi.resetModules();
    vi.doMock('@opentelemetry/api', () => {
      const span = {
        setStatus: vi.fn(),
        recordException: vi.fn(),
        end: vi.fn(),
      };
      const startSpan = vi.fn(() => span);
      const getTracer = vi.fn(() => ({ startSpan }));
      return {
        trace: { getTracer },
        SpanStatusCode: { OK: 1, ERROR: 2 },
        __mocks: { startSpan },
      };
    });

    const { withGoldenSpan } = await import('./golden-span.js');
    const { __mocks } = await import('@opentelemetry/api');

    await expect(
      withGoldenSpan('test.span', ctx, 'REASONER', async () => 'ok')
    ).resolves.toBe('ok');

    expect((__mocks as any).startSpan).toHaveBeenCalledTimes(1);
  });
});

