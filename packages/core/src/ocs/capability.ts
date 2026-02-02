/**
 * packages/core/src/ocs/capability.ts
 * OCS Capability interface (normative); factory uses CapabilityContext with GoldenContext.
 */
import type { z } from '@golden/schema-registry';
import type { CapabilityContext } from '../types.js';
import type { ErrorCategory } from '../types.js';

/** Dagger container definition (kept abstract to avoid forcing a Dagger runtime dependency here). */
export type DaggerContainer = unknown;

/** Strict Retry Policy for idempotent operations. */
export interface RetryPolicy {
  maxAttempts: number;
  initialIntervalSeconds: number;
  backoffCoefficient: number;
}

/** OCS Capability interface. Factory is pure; no side effects during factory phase. */
export interface Capability<
  Input = unknown,
  Output = unknown,
  Config = unknown,
  Secrets = unknown,
> {
  metadata: {
    id: string;
    version: string;
    name: string;
    description: string;
    /**
     * Discovery taxonomy (CDM-001).
     *
     * NOTE: This is optional for backwards compatibility, but CI/generators
     * should enforce/populate it for all new/updated capabilities.
     */
    domain?: string;
    /**
     * Optional finer-grained discovery taxonomy (CDM-001).
     */
    subdomain?: string;
    tags: string[];
    maintainer: string;
  };

  schemas: {
    // Use ZodType<T, any, any> to allow input type to differ from output type
    // This is necessary for schemas using .optional().default() patterns
    input: z.ZodType<Input>;
    output: z.ZodType<Output>;
    config: z.ZodType<Config>;
    secrets: z.ZodType<Secrets>;
  };

  security: {
    requiredScopes: string[];
    dataClassification: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
    oscalControlIds?: string[];
    networkAccess: { allowOutbound: string[] };
  };

  operations: {
    isIdempotent: boolean;
    retryPolicy: RetryPolicy;
    errorMap: (error: unknown) => ErrorCategory;
    metrics?: {
      name: string;
      type: 'COUNTER' | 'GAUGE' | 'HISTOGRAM';
      description: string;
    }[];
    costFactor: 'LOW' | 'MEDIUM' | 'HIGH';
  };

  aiHints: {
    exampleInput: Input;
    exampleOutput: Output;
    usageNotes?: string;
  };

  /**
   * Pure factory: returns a Dagger container definition. No side effects.
   * Context includes GoldenContext for identity and observability.
   */
  factory: (
    dag: unknown,
    context: CapabilityContext<Config, Secrets>,
    input: Input
  ) => DaggerContainer;
}
