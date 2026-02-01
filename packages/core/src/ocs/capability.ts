/**
 * packages/core/src/ocs/capability.ts
 * OCS Capability interface (normative); factory uses CapabilityContext with GoldenContext.
 */
import type { z } from '@golden/schema-registry';
import type { CapabilityContext } from '../types.js';
import type { ErrorCategory } from '../types.js';

/** Dagger container definition (kept abstract to avoid forcing a Dagger runtime dependency here). */
export type DaggerContainer = unknown;

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
    tags: string[];
    maintainer: string;
  };

  schemas: {
    input: z.ZodSchema<Input>;
    output: z.ZodSchema<Output>;
    config: z.ZodSchema<Config>;
    secrets: z.ZodSchema<Secrets>;
  };

  security: {
    requiredScopes: string[];
    dataClassification: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
    oscalControlIds?: string[];
    networkAccess: { allowOutbound: string[] };
  };

  operations: {
    isIdempotent: boolean;
    retryPolicy: {
      maxAttempts: number;
      initialIntervalSeconds: number;
      backoffCoefficient: number;
    };
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
