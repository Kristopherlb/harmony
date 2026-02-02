/**
 * packages/core/src/finops/llm-cost.ts
 *
 * Purpose: Small, deterministic FinOps utilities for LLM usage tracking.
 *
 * This module intentionally has:
 * - no network calls
 * - no environment variable reads
 * - deterministic behavior (safe for reuse anywhere, including Temporal-adjacent code)
 */
export type LlmProvider = 'openai' | 'anthropic' | 'local' | 'mock';

export type LlmRate = {
  /** USD per 1,000,000 input tokens */
  inputUsdPer1M: number;
  /** USD per 1,000,000 output tokens */
  outputUsdPer1M: number;
};

export type LlmPricingTable = Record<LlmProvider, Record<string, LlmRate>>;

export type LlmCostInput = {
  pricing: LlmPricingTable;
  provider: LlmProvider;
  model: string;
  inputTokens: number;
  outputTokens: number;
};

export type LlmCostResult = {
  usd: number;
  rate: LlmRate;
};

export function getDefaultLlmPricing(): LlmPricingTable {
  return {
    // NOTE: keep these as defaults only. Callers should override if they need exact vendor pricing.
    openai: {
      // Common defaults used in this repo; update if vendor pricing changes.
      'gpt-4o': { inputUsdPer1M: 5, outputUsdPer1M: 15 },
      'gpt-4o-mini': { inputUsdPer1M: 0.15, outputUsdPer1M: 0.6 },
    },
    anthropic: {
      // Intentionally empty by default; supply via caller config.
    },
    local: {
      // Local models are treated as "free" from a vendor-billing perspective.
      '*': { inputUsdPer1M: 0, outputUsdPer1M: 0 },
    },
    mock: {
      '*': { inputUsdPer1M: 0, outputUsdPer1M: 0 },
    },
  };
}

export class BudgetExceededError extends Error {
  readonly name = 'BudgetExceededError';

  constructor(message: string) {
    super(message);
    Error.captureStackTrace(this, BudgetExceededError);
  }
}

const ensureNonNegativeInt = (label: string, value: number) => {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a non-negative number`);
  }
};

function getRate(pricing: LlmPricingTable, provider: LlmProvider, model: string): LlmRate {
  // Local/mock are always free.
  if (provider === 'local' || provider === 'mock') {
    return { inputUsdPer1M: 0, outputUsdPer1M: 0 };
  }

  const providerRates = pricing[provider] ?? {};
  const direct = providerRates[model];
  if (direct) return direct;

  const wildcard = providerRates['*'];
  if (wildcard) return wildcard;

  // Unknown pricing: treat as zero (caller should override pricing table).
  return { inputUsdPer1M: 0, outputUsdPer1M: 0 };
}

export function calculateLlmCostUsd(input: LlmCostInput): LlmCostResult {
  ensureNonNegativeInt('inputTokens', input.inputTokens);
  ensureNonNegativeInt('outputTokens', input.outputTokens);

  const rate = getRate(input.pricing, input.provider, input.model);

  const inputUsd = (input.inputTokens / 1_000_000) * rate.inputUsdPer1M;
  const outputUsd = (input.outputTokens / 1_000_000) * rate.outputUsdPer1M;
  return { usd: inputUsd + outputUsd, rate };
}

export type LlmBudgetWindow = 'run' | 'day';

export type LlmBudgetPolicy = {
  /** Hard stop budget in USD for the chosen window. */
  hardLimitUsd: number;
  /** Accounting window for the budget. */
  window: LlmBudgetWindow;
};

export type LlmUsageEntry = {
  provider: LlmProvider;
  model: string;
  inputTokens: number;
  outputTokens: number;
  usd: number;
};

export type LlmUsageTotals = {
  inputTokens: number;
  outputTokens: number;
  usd: number;
};

export type LlmCostManagerConfig = {
  pricing: LlmPricingTable;
  /**
   * Optional per-budgetKey policy. Use keys like:
   * - user:<id>
   * - team:<id>
   * - session:<id>
   */
  budgetByKey?: Record<string, LlmBudgetPolicy>;
  /** Injected clock for deterministic testing. */
  now?: () => Date;
};

export type RecordUsageInput = {
  budgetKey: string;
  provider: LlmProvider;
  model: string;
  inputTokens: number;
  outputTokens: number;
};

export class LlmCostManager {
  private readonly pricing: LlmPricingTable;
  private readonly budgetByKey: Record<string, LlmBudgetPolicy>;
  private readonly now: () => Date;
  private readonly totalsByWindowKey: Map<string, LlmUsageTotals>;

  constructor(config: LlmCostManagerConfig) {
    this.pricing = config.pricing;
    this.budgetByKey = config.budgetByKey ?? {};
    this.now = config.now ?? (() => new Date());
    this.totalsByWindowKey = new Map();
  }

  setBudget(budgetKey: string, policy: LlmBudgetPolicy): void {
    this.budgetByKey[budgetKey] = policy;
  }

  getBudget(budgetKey: string): LlmBudgetPolicy | undefined {
    return this.budgetByKey[budgetKey];
  }

  getTotals(input: { budgetKey: string }): LlmUsageTotals {
    const policy = this.budgetByKey[input.budgetKey];
    const windowKey = this.windowKey(input.budgetKey, policy?.window ?? 'run');
    return this.totalsByWindowKey.get(windowKey) ?? { inputTokens: 0, outputTokens: 0, usd: 0 };
  }

  recordUsage(input: RecordUsageInput): LlmUsageEntry {
    const policy = this.budgetByKey[input.budgetKey];
    const window = policy?.window ?? 'run';
    const windowKey = this.windowKey(input.budgetKey, window);

    const current = this.totalsByWindowKey.get(windowKey) ?? { inputTokens: 0, outputTokens: 0, usd: 0 };
    const cost = calculateLlmCostUsd({
      pricing: this.pricing,
      provider: input.provider,
      model: input.model,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
    });

    const next: LlmUsageTotals = {
      inputTokens: current.inputTokens + input.inputTokens,
      outputTokens: current.outputTokens + input.outputTokens,
      usd: current.usd + cost.usd,
    };

    if (policy && next.usd > policy.hardLimitUsd) {
      throw new BudgetExceededError(
        `LLM budget exceeded for ${input.budgetKey} (${window}). ` +
          `limit=$${policy.hardLimitUsd.toFixed(4)}, projected=$${next.usd.toFixed(4)}`,
      );
    }

    this.totalsByWindowKey.set(windowKey, next);
    return {
      provider: input.provider,
      model: input.model,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      usd: cost.usd,
    };
  }

  private windowKey(budgetKey: string, window: LlmBudgetWindow): string {
    if (window === 'run') return `${budgetKey}:run`;
    const d = this.now();
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${budgetKey}:day:${y}-${m}-${day}`;
  }
}

export function createInMemoryLlmCostManager(config: LlmCostManagerConfig): LlmCostManager {
  return new LlmCostManager(config);
}

