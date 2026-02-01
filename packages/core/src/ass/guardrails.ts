/**
 * packages/core/src/ass/guardrails.ts
 * Token/iteration guardrails and RESTRICTED tool → HITL (ASS 2.3).
 */
/** Options for reasoning cycle guardrails. */
export interface GuardrailOptions {
  max_iterations: number;
  token_limit?: number;
}

/** Result of a guardrail check: pass or interrupt for HITL. */
export type GuardrailResult =
  | { pass: true }
  | { pass: false; reason: 'MAX_ITERATIONS_EXCEEDED' | 'TOKEN_LIMIT_EXCEEDED' | 'RESTRICTED_TOOL_REQUIRES_APPROVAL' };

/**
 * Check iteration count against max_iterations (ASS 2.3.2).
 */
export function checkIterationGuardrail(
  currentIterations: number,
  options: GuardrailOptions
): GuardrailResult {
  if (currentIterations >= options.max_iterations) {
    return { pass: false, reason: 'MAX_ITERATIONS_EXCEEDED' };
  }
  return { pass: true };
}

/**
 * Check token usage against token_limit when set (ASS 2.3.2).
 */
export function checkTokenGuardrail(
  currentTokens: number,
  options: GuardrailOptions
): GuardrailResult {
  if (options.token_limit != null && currentTokens >= options.token_limit) {
    return { pass: false, reason: 'TOKEN_LIMIT_EXCEEDED' };
  }
  return { pass: true };
}

/**
 * Check if a tool's data classification requires HITL (ASS 2.3.3).
 * RESTRICTED tools must trigger an interrupt before execution.
 */
export function checkRestrictedToolGuardrail(
  dataClassification: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED'
): GuardrailResult {
  if (dataClassification === 'RESTRICTED') {
    return { pass: false, reason: 'RESTRICTED_TOOL_REQUIRES_APPROVAL' };
  }
  return { pass: true };
}
