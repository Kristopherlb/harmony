import { describe, expect, it } from 'vitest';
import { calculateRunCost } from './cost-analyzer.js';

describe('calculateRunCost', () => {
  it('calculates a full TCO breakdown with defaults', () => {
    const result = calculateRunCost({
      temporalActions: 100,
      compute: [
        { capabilityId: 'dagger.build', computeSeconds: 10, ratePerSecond: 0.002 },
        { capabilityId: 'dagger.test', computeSeconds: 5, ratePerSecond: 0.001 },
      ],
      intelligence: [
        {
          model: 'gpt-4o-mini',
          inputTokens: 1000,
          outputTokens: 500,
          ratePerToken: 0.000002,
        },
      ],
      apiFees: 0.5,
    });

    expect(result.breakdown.temporal).toBeCloseTo(0.001);
    expect(result.breakdown.compute).toBeCloseTo(0.025);
    expect(result.breakdown.intelligence).toBeCloseTo(0.003);
    expect(result.breakdown.apiFees).toBeCloseTo(0.5);
    expect(result.total).toBeCloseTo(0.529);
  });

  it('supports zero-usage runs', () => {
    const result = calculateRunCost({
      temporalActions: 0,
      compute: [],
      intelligence: [],
    });

    expect(result.total).toBe(0);
    expect(result.breakdown).toEqual({
      temporal: 0,
      compute: 0,
      intelligence: 0,
      apiFees: 0,
    });
  });

  it('rejects negative inputs', () => {
    expect(() =>
      calculateRunCost({
        temporalActions: -1,
        compute: [],
        intelligence: [],
      }),
    ).toThrow('temporalActions must be non-negative');
  });
});
