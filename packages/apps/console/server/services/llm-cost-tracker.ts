/**
 * packages/apps/console/server/services/llm-cost-tracker.ts
 *
 * Purpose: shared, in-memory LLM cost/budget tracker for Console.
 *
 * This is intentionally process-local (not persisted) and keyed by budgetKey
 * values like `user:<id>` or `session:<id>`.
 */
import * as coreNamespace from "@golden/core";
import { unwrapCjsNamespace } from "../lib/cjs-interop";

const core = unwrapCjsNamespace<typeof coreNamespace>(coreNamespace as any);

const defaultPricing = core.getDefaultLlmPricing();
const llmCostManager = core.createInMemoryLlmCostManager({ pricing: defaultPricing });

export function getDefaultPricing() {
  return defaultPricing;
}

export function getLlmCostManager() {
  return llmCostManager;
}

export function getBudgetPolicy(input: { budgetKey: string }) {
  return llmCostManager.getBudget(input.budgetKey);
}

export function setBudgetPolicy(input: { budgetKey: string; policy: core.LlmBudgetPolicy }) {
  llmCostManager.setBudget(input.budgetKey, input.policy);
}

export function getTotals(input: { budgetKey: string }) {
  return llmCostManager.getTotals({ budgetKey: input.budgetKey });
}

