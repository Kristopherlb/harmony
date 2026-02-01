/**
 * packages/core/src/ocs/error-normalizer.ts
 * Maps raw errors to OCS ErrorCategory and Temporal-retry hints (OCS 3.5.1).
 */
import type { ErrorCategory } from '../types.js';

/** Normalized error shape for retry behavior and logging. */
export interface NormalizedError {
  category: ErrorCategory;
  retryable: boolean;
  message: string;
  originalCode?: string | number;
  nonRetryableReason?: string;
}

/** Pattern and category for regex fallback. */
interface RegexRule {
  pattern: RegExp;
  category: ErrorCategory;
  retryable: boolean;
}

const DEFAULT_REGEX_RULES: RegexRule[] = [
  { pattern: /rate\s*limit|throttl/i, category: 'RATE_LIMIT', retryable: true },
  { pattern: /unauthorized|auth.*fail|invalid.*token/i, category: 'AUTH_FAILURE', retryable: false },
  { pattern: /timeout|unavailable|retry\s+later/i, category: 'RETRYABLE', retryable: true },
];

function fromStatusCode(statusCode: number): { category: ErrorCategory; retryable: boolean } | null {
  if (statusCode === 401 || statusCode === 403) return { category: 'AUTH_FAILURE', retryable: false };
  if (statusCode === 429) return { category: 'RATE_LIMIT', retryable: true };
  if (statusCode >= 500 || statusCode === 408) return { category: 'RETRYABLE', retryable: true };
  if (statusCode >= 400 && statusCode < 500) return { category: 'FATAL', retryable: false };
  return null;
}

/**
 * Normalize a raw error: structured/statusCode → capability errorMap → regex fallbacks.
 */
export function normalizeError(
  error: unknown,
  capabilityErrorMap?: (err: unknown) => ErrorCategory
): NormalizedError {
  const message = error instanceof Error ? error.message : String(error);
  const code = typeof (error as { statusCode?: number }).statusCode === 'number'
    ? (error as { statusCode: number }).statusCode
    : (error as { code?: string | number }).code;

  if (typeof code === 'number') {
    const byStatus = fromStatusCode(code);
    if (byStatus) {
      return {
        category: byStatus.category,
        retryable: byStatus.retryable,
        message,
        originalCode: code,
      };
    }
  }

  if (capabilityErrorMap) {
    const category = capabilityErrorMap(error);
    const retryable = category === 'RETRYABLE' || category === 'RATE_LIMIT';
    return {
      category,
      retryable,
      message,
      originalCode: code,
    };
  }

  for (const rule of DEFAULT_REGEX_RULES) {
    if (rule.pattern.test(message)) {
      return {
        category: rule.category,
        retryable: rule.retryable,
        message,
        originalCode: code,
      };
    }
  }

  return {
    category: 'FATAL',
    retryable: false,
    message,
    originalCode: code,
    nonRetryableReason: 'No mapping or fallback matched',
  };
}
