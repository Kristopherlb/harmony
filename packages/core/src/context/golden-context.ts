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

/** Incident severity levels for incident tracking. */
export const INCIDENT_SEVERITY = ['P1', 'P2', 'P3', 'P4'] as const;
export type IncidentSeverity = (typeof INCIDENT_SEVERITY)[number];

/** Zod schema for GoldenContext. */
export const goldenContextSchema = z.object({
  // Core identity fields (required)
  app_id: z.string().min(1),
  environment: z.string().min(1),
  initiator_id: z.string().min(1),
  trace_id: z.string().min(1),

  // Cost and classification (optional)
  cost_center: z.string().optional(),
  data_classification: z.enum(DATA_CLASSIFICATION).optional(),

  // Incident tracking fields (optional - populated during incident workflows)
  /** Unique incident identifier, e.g., "INC-2024-001" */
  incident_id: z.string().optional(),
  /** Incident severity level */
  incident_severity: z.enum(INCIDENT_SEVERITY).optional(),
  /** Incident title/summary */
  incident_title: z.string().optional(),
  /** Slack channel ID for incident communications */
  incident_channel: z.string().optional(),
  /** PagerDuty incident ID for correlation */
  pagerduty_incident_id: z.string().optional(),
  /** Statuspage incident ID for correlation */
  statuspage_incident_id: z.string().optional(),
  /** ISO timestamp when incident started */
  incident_started_at: z.string().optional(),
  /** List of impacted service names */
  impacted_services: z.array(z.string()).optional(),
});

export type GoldenContext = z.infer<typeof goldenContextSchema>;

/**
 * Parse and validate unknown input as GoldenContext.
 * Strips unknown fields.
 */
export function parseGoldenContext(input: unknown): GoldenContext {
  return goldenContextSchema.parse(input) as GoldenContext;
}

/**
 * Check if the context has incident tracking information.
 */
export function hasIncidentContext(ctx: GoldenContext): boolean {
  return !!ctx.incident_id;
}

/**
 * Extract incident-specific fields from GoldenContext.
 * Returns undefined if no incident_id is set.
 */
export function extractIncidentFields(ctx: GoldenContext): {
  incident_id: string;
  incident_severity?: IncidentSeverity;
  incident_title?: string;
  incident_channel?: string;
  pagerduty_incident_id?: string;
  statuspage_incident_id?: string;
  incident_started_at?: string;
  impacted_services?: string[];
} | undefined {
  if (!ctx.incident_id) return undefined;
  return {
    incident_id: ctx.incident_id,
    incident_severity: ctx.incident_severity,
    incident_title: ctx.incident_title,
    incident_channel: ctx.incident_channel,
    pagerduty_incident_id: ctx.pagerduty_incident_id,
    statuspage_incident_id: ctx.statuspage_incident_id,
    incident_started_at: ctx.incident_started_at,
    impacted_services: ctx.impacted_services,
  };
}
