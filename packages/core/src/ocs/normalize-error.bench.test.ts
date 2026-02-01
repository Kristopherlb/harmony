/**
 * Micro-bench: ErrorNormalizer and execute-path shaping overhead (Phase 2 NFR: <5ms per wrapper).
 * Run with: pnpm exec vitest run src/ocs/normalize-error.bench --testTimeout=30000
 * CI should run this; fail if average per call exceeds threshold.
 */
import { describe, it, expect } from 'vitest';
import { normalizeError } from './error-normalizer';
import type { ExecuteCapabilityActivityInput } from '../wcs/execute-capability-activity.js';

const ITERATIONS = 50_000;
const MAX_AVG_MS_PER_NORMALIZE = 0.005; // 5µs per call (0.005ms)
const MAX_AVG_MS_PER_EXECUTE_SHAPE = 0.005;

describe('normalizeError overhead', () => {
  it('stays under threshold per call (wrapper negligible)', () => {
    const err = new Error('Rate limit exceeded');
    const start = performance.now();
    for (let i = 0; i < ITERATIONS; i++) {
      normalizeError(err);
    }
    const elapsed = performance.now() - start;
    const avgMs = elapsed / ITERATIONS;
    expect(avgMs).toBeLessThan(MAX_AVG_MS_PER_NORMALIZE);
  });
});

describe('execute input shape overhead', () => {
  it('building activity input shape stays under threshold', () => {
    const start = performance.now();
    for (let i = 0; i < ITERATIONS; i++) {
      const payload: ExecuteCapabilityActivityInput<{ x: number }> = {
        capId: 'golden.echo',
        input: { x: i },
        runAs: 'user:bench',
        traceId: 'trace-bench',
      };
      void payload;
    }
    const elapsed = performance.now() - start;
    const avgMs = elapsed / ITERATIONS;
    expect(avgMs).toBeLessThan(MAX_AVG_MS_PER_EXECUTE_SHAPE);
  });
});
