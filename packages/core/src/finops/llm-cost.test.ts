import { describe, expect, it } from 'vitest';

import {
  BudgetExceededError,
  calculateLlmCostUsd,
  createInMemoryLlmCostManager,
  getDefaultLlmPricing,
} from './llm-cost.js';

describe('calculateLlmCostUsd', () => {
  it('computes cost for known priced models (separate input/output rates)', () => {
    const pricing = getDefaultLlmPricing();
    const cost = calculateLlmCostUsd({
      pricing,
      provider: 'openai',
      model: 'gpt-4o',
      inputTokens: 1000,
      outputTokens: 500,
    });

    // Using default pricing: gpt-4o input=$5/1M, output=$15/1M
    // => 1000 * 5e-6 + 500 * 15e-6 = 0.005 + 0.0075 = 0.0125
    expect(cost.usd).toBeCloseTo(0.0125);
    expect(cost.rate).toMatchObject({
      inputUsdPer1M: 5,
      outputUsdPer1M: 15,
    });
  });

  it('treats local/mock providers as zero-cost', () => {
    const pricing = getDefaultLlmPricing();
    const cost = calculateLlmCostUsd({
      pricing,
      provider: 'local',
      model: 'llama3',
      inputTokens: 999,
      outputTokens: 999,
    });

    expect(cost.usd).toBe(0);
    expect(cost.rate).toMatchObject({ inputUsdPer1M: 0, outputUsdPer1M: 0 });
  });
});

describe('LlmCostManager', () => {
  it('enforces a hard USD budget per budgetKey (run window)', () => {
    const mgr = createInMemoryLlmCostManager({
      pricing: getDefaultLlmPricing(),
      budgetByKey: {
        'user:test': { hardLimitUsd: 0.01, window: 'run' },
      },
    });

    expect(() =>
      mgr.recordUsage({
        budgetKey: 'user:test',
        provider: 'openai',
        model: 'gpt-4o',
        inputTokens: 1000,
        outputTokens: 500,
      }),
    ).toThrow(BudgetExceededError);
  });

  it('supports setting budgets dynamically (useful for per-request policies)', () => {
    const mgr = createInMemoryLlmCostManager({
      pricing: getDefaultLlmPricing(),
    });

    mgr.setBudget('user:test', { hardLimitUsd: 0.02, window: 'run' });

    expect(() =>
      mgr.recordUsage({
        budgetKey: 'user:test',
        provider: 'openai',
        model: 'gpt-4o',
        inputTokens: 1000,
        outputTokens: 0,
      }),
    ).not.toThrow();
  });

  it('accumulates usage totals for a budgetKey', () => {
    const mgr = createInMemoryLlmCostManager({
      pricing: getDefaultLlmPricing(),
      budgetByKey: {
        'user:test': { hardLimitUsd: 1, window: 'run' },
      },
    });

    mgr.recordUsage({
      budgetKey: 'user:test',
      provider: 'openai',
      model: 'gpt-4o-mini',
      inputTokens: 10_000,
      outputTokens: 5_000,
    });

    mgr.recordUsage({
      budgetKey: 'user:test',
      provider: 'openai',
      model: 'gpt-4o-mini',
      inputTokens: 2_000,
      outputTokens: 1_000,
    });

    const totals = mgr.getTotals({ budgetKey: 'user:test' });
    expect(totals.inputTokens).toBe(12_000);
    expect(totals.outputTokens).toBe(6_000);
    expect(totals.usd).toBeGreaterThan(0);
  });
});

