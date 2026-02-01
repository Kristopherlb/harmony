/**
 * packages/core/src/ocs/base-capability.ts
 * Optional abstract base for OCS Capabilities with default errorMap and retry policy.
 */
import type { Capability } from './capability.js';
import type { ErrorCategory } from '../types.js';
import { normalizeError } from './error-normalizer.js';

/** Default retry policy for idempotent capabilities. */
const DEFAULT_RETRY_POLICY = {
  maxAttempts: 3,
  initialIntervalSeconds: 1,
  backoffCoefficient: 2,
};

/**
 * Abstract base that supplies default operations.errorMap (via ErrorNormalizer)
 * and optional default retry policy. Subclasses define metadata, schemas, security, aiHints, and factory.
 */
export abstract class BaseCapability<
  Input = unknown,
  Output = unknown,
  Config = unknown,
  Secrets = unknown,
> implements Capability<Input, Output, Config, Secrets> {
  abstract metadata: Capability<Input, Output, Config, Secrets>['metadata'];
  abstract schemas: Capability<Input, Output, Config, Secrets>['schemas'];
  abstract security: Capability<Input, Output, Config, Secrets>['security'];
  abstract aiHints: Capability<Input, Output, Config, Secrets>['aiHints'];
  abstract factory: Capability<Input, Output, Config, Secrets>['factory'];

  /** Override in subclass to customize error mapping; default uses ErrorNormalizer. */
  protected errorMap(error: unknown): ErrorCategory {
    return normalizeError(error, undefined).category;
  }

  get operations(): Capability<Input, Output, Config, Secrets>['operations'] {
    return {
      isIdempotent: true,
      retryPolicy: DEFAULT_RETRY_POLICY,
      errorMap: (err) => this.errorMap(err),
      costFactor: 'LOW',
    };
  }
}
