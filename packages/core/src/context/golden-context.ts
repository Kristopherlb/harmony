/**
 * packages/core/src/context/golden-context.ts
 * GoldenContext and validation per GOS/UIM (Phase 2 public API).
 */
import { z } from '@golden/schema-registry';

/** Data classification levels (GOS-001). */
export const DATA_CLASSIFICATION = [
  'PUBLIC',
  'INTERNAL',
  'CONFIDENTIAL',
  'RESTRICTED',
] as const;

export type DataClassification = (typeof DATA_CLASSIFICATION)[number];

/** Zod schema for GoldenContext. */
export const goldenContextSchema = z.object({
  app_id: z.string().min(1),
  environment: z.string().min(1),
  initiator_id: z.string().min(1),
  trace_id: z.string().min(1),
  cost_center: z.string().optional(),
  data_classification: z.enum(DATA_CLASSIFICATION).optional(),
});

export type GoldenContext = z.infer<typeof goldenContextSchema>;

/**
 * Parse and validate unknown input as GoldenContext.
 * Strips unknown fields.
 */
export function parseGoldenContext(input: unknown): GoldenContext {
  return goldenContextSchema.parse(input) as GoldenContext;
}
