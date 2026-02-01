/**
 * packages/core/src/binders/context-injector.ts
 * Context injector contract: hydrate agent/workflow context (Keycloak attributes, etc.).
 * Phase 2: interface and hook points only; no full Keycloak/RAG implementation.
 */
import type { GoldenContext } from '../context/golden-context.js';

/** Enriched context with optional user/agent attributes (UIM claims, cost center, etc.). */
export interface EnrichedContext extends GoldenContext {
  cost_center?: string;
  clearance_level?: string;
  user_attributes?: Record<string, unknown>;
}

/**
 * Injects user context (e.g. Keycloak attributes) or long-term memory into GoldenContext.
 * Lifecycle hooks: before workflow start, before agent reasoning cycle.
 */
export interface ContextInjector {
  inject(ctx: GoldenContext): Promise<EnrichedContext>;
}

/** No-op injector for testing or when enrichment is not configured. */
export const noopContextInjector: ContextInjector = {
  async inject(ctx) {
    return { ...ctx };
  },
};
