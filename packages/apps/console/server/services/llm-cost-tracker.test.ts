/**
 * packages/apps/console/server/services/llm-cost-tracker.test.ts
 * Regression: core import interop (CJS default vs ESM namespace) must not crash.
 */
import { describe, expect, it, vi } from "vitest";

describe("llm-cost-tracker core import interop", () => {
  it("works when @golden/core provides a default export (CJS-style)", async () => {
    vi.resetModules();
    vi.doMock("@golden/core", () => {
      const core = {
        getDefaultLlmPricing: () => ({ provider: "openai", models: {} }),
        createInMemoryLlmCostManager: () => ({
          getBudget: () => undefined,
          setBudget: () => {},
          recordUsage: () => ({ usd: 0 }),
          getTotals: () => ({ usd: 0, inputTokens: 0, outputTokens: 0 }),
        }),
      };
      return { default: core };
    });

    const mod = await import("./llm-cost-tracker");
    expect(mod.getDefaultPricing()).toEqual({ provider: "openai", models: {} });
    expect(mod.getTotals({ budgetKey: "user:test" })).toEqual({ usd: 0, inputTokens: 0, outputTokens: 0 });
  });

  it("works when @golden/core provides named exports (ESM-style)", async () => {
    vi.resetModules();
    vi.doMock("@golden/core", () => {
      return {
        // Some module systems provide no meaningful default export. We still include an empty
        // default here so Vitest's default-import behavior does not throw.
        default: {},
        getDefaultLlmPricing: () => ({ provider: "openai", models: {} }),
        createInMemoryLlmCostManager: () => ({
          getBudget: () => undefined,
          setBudget: () => {},
          recordUsage: () => ({ usd: 0 }),
          getTotals: () => ({ usd: 0, inputTokens: 0, outputTokens: 0 }),
        }),
      };
    });

    const mod = await import("./llm-cost-tracker");
    expect(mod.getDefaultPricing()).toEqual({ provider: "openai", models: {} });
    expect(mod.getTotals({ budgetKey: "user:test" })).toEqual({ usd: 0, inputTokens: 0, outputTokens: 0 });
  });

  it("falls back to default export when namespace is partial", async () => {
    vi.resetModules();
    vi.doMock("@golden/core", () => {
      const fullCore = {
        getDefaultLlmPricing: () => ({ provider: "openai", models: { "gpt-4o-mini": { inputPer1k: 0.0015 } } }),
        createInMemoryLlmCostManager: () => ({
          getBudget: () => undefined,
          setBudget: () => {},
          recordUsage: () => ({ usd: 0 }),
          getTotals: () => ({ usd: 0, inputTokens: 0, outputTokens: 0 }),
        }),
      };
      return {
        // Simulates Node ESM/CJS interop where only some named exports are discovered.
        readOpenBaoKvV2SecretValue: () => "stub",
        default: fullCore,
      };
    });

    const mod = await import("./llm-cost-tracker");
    expect(mod.getDefaultPricing()).toEqual({
      provider: "openai",
      models: { "gpt-4o-mini": { inputPer1k: 0.0015 } },
    });
  });
});

