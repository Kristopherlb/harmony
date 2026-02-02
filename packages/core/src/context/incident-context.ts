/**
 * packages/core/src/context/incident-context.ts
 * Incident Context helpers for incident lifecycle workflows.
 *
 * Provides utilities for creating, enriching, and extracting incident-related
 * context from GoldenContext for use in incident management blueprints.
 */
import type { GoldenContext, IncidentSeverity } from './golden-context.js';

/**
 * Standalone incident context structure for creating new incidents.
 */
export interface IncidentContext {
  /** Unique incident identifier, e.g., "INC-2024-001" */
  incident_id: string;
  /** Incident severity level */
  severity: IncidentSeverity;
  /** Human-readable incident title/summary */
  title: string;
  /** Slack channel ID for incident communications */
  channel?: string;
  /** PagerDuty incident ID for correlation */
  pagerduty_id?: string;
  /** Statuspage incident ID for correlation */
  statuspage_id?: string;
  /** ISO timestamp when incident started */
  started_at: string;
  /** List of impacted service names */
  impacted_services: string[];
}

/**
 * Options for generating an incident ID.
 */
export interface IncidentIdOptions {
  /** Prefix for the ID (default: "INC") */
  prefix?: string;
  /** Year to use (default: current year) */
  year?: number;
  /** Sequence number for the incident */
  sequence: number;
}

/**
 * Generate a formatted incident ID.
 *
 * @example
 * generateIncidentId({ sequence: 42 }) // "INC-2024-042"
 * generateIncidentId({ prefix: "SEC", year: 2025, sequence: 1 }) // "SEC-2025-001"
 */
export function generateIncidentId(options: IncidentIdOptions): string {
  const prefix = options.prefix ?? 'INC';
  const year = options.year ?? new Date().getFullYear();
  const sequence = String(options.sequence).padStart(3, '0');
  return `${prefix}-${year}-${sequence}`;
}

/**
 * Create a GoldenContext enriched with incident information.
 * Use this when starting incident-related workflows.
 *
 * @param baseContext - The base GoldenContext (from workflow start)
 * @param incident - The incident context to merge
 * @returns GoldenContext with incident fields populated
 */
export function createIncidentGoldenContext(
  baseContext: GoldenContext,
  incident: IncidentContext
): GoldenContext {
  return {
    ...baseContext,
    incident_id: incident.incident_id,
    incident_severity: incident.severity,
    incident_title: incident.title,
    incident_channel: incident.channel,
    pagerduty_incident_id: incident.pagerduty_id,
    statuspage_incident_id: incident.statuspage_id,
    incident_started_at: incident.started_at,
    impacted_services: incident.impacted_services,
  };
}

/**
 * Extract incident context from a GoldenContext.
 * Returns undefined if the context doesn't have incident information.
 *
 * @param ctx - GoldenContext that may contain incident fields
 * @returns IncidentContext if incident_id is present, undefined otherwise
 */
export function extractIncidentContext(ctx: GoldenContext): IncidentContext | undefined {
  if (!ctx.incident_id) {
    return undefined;
  }

  return {
    incident_id: ctx.incident_id,
    severity: ctx.incident_severity ?? 'P4',
    title: ctx.incident_title ?? ctx.incident_id,
    channel: ctx.incident_channel,
    pagerduty_id: ctx.pagerduty_incident_id,
    statuspage_id: ctx.statuspage_incident_id,
    started_at: ctx.incident_started_at ?? new Date().toISOString(),
    impacted_services: ctx.impacted_services ?? [],
  };
}

/**
 * Check if a GoldenContext has incident tracking information.
 */
export function hasIncidentContext(ctx: GoldenContext): boolean {
  return !!ctx.incident_id;
}

/**
 * Update incident context fields in an existing GoldenContext.
 * Useful for updating status or adding correlation IDs during the incident lifecycle.
 *
 * @param ctx - Original GoldenContext
 * @param updates - Partial incident context updates
 * @returns Updated GoldenContext
 */
export function updateIncidentContext(
  ctx: GoldenContext,
  updates: Partial<Omit<IncidentContext, 'incident_id' | 'severity' | 'started_at'>>
): GoldenContext {
  return {
    ...ctx,
    ...(updates.title && { incident_title: updates.title }),
    ...(updates.channel && { incident_channel: updates.channel }),
    ...(updates.pagerduty_id && { pagerduty_incident_id: updates.pagerduty_id }),
    ...(updates.statuspage_id && { statuspage_incident_id: updates.statuspage_id }),
    ...(updates.impacted_services && { impacted_services: updates.impacted_services }),
  };
}

/**
 * Generate a Slack channel name for an incident.
 *
 * @example
 * generateIncidentChannelName("INC-2024-042", "api-gateway")
 * // Returns: "inc-2024-042-api-gateway"
 */
export function generateIncidentChannelName(incidentId: string, service?: string): string {
  const base = incidentId.toLowerCase();
  if (service) {
    // Sanitize service name for Slack channel naming
    const sanitizedService = service.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 20);
    return `${base}-${sanitizedService}`;
  }
  return base;
}

/**
 * Build a summary string for an incident.
 * Useful for notifications and audit logs.
 */
export function buildIncidentSummary(incident: IncidentContext): string {
  const services = incident.impacted_services.length > 0
    ? incident.impacted_services.join(', ')
    : 'Unknown';

  return `[${incident.severity}] ${incident.incident_id}: ${incident.title} (Services: ${services})`;
}

/**
 * Determine if an incident is high priority (P1 or P2).
 */
export function isHighPriority(incident: IncidentContext): boolean {
  return incident.severity === 'P1' || incident.severity === 'P2';
}

/**
 * Get the default timeout for approval based on incident severity.
 * Higher severity incidents have shorter approval timeouts.
 */
export function getApprovalTimeoutForSeverity(severity: IncidentSeverity): string {
  switch (severity) {
    case 'P1':
      return '5m';
    case 'P2':
      return '15m';
    case 'P3':
      return '30m';
    case 'P4':
    default:
      return '1h';
  }
}
