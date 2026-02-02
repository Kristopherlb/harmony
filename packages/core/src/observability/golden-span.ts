/**
 * packages/core/src/observability/golden-span.ts
 * GOS-001: golden.* span attributes and span injection for capability/blueprint execution.
 */
import { trace, type Span, SpanStatusCode } from '@opentelemetry/api';
import type { GoldenContext } from '../context/golden-context.js';

const TRACER_NAME = 'golden-path';
const TRACER_VERSION = '1.0.0';

/** GOS semantic attribute keys. */
export const GOLDEN_ATTRIBUTES = {
  APP_ID: 'golden.app_id',
  COMPONENT_TYPE: 'golden.component_type',
  DATA_CLASSIFICATION: 'golden.data_classification',
  COST_CENTER: 'golden.cost_center',
  INITIATOR_ID: 'golden.initiator_id',
  IS_COMPENSATION: 'golden.is_compensation',
  BUSINESS_VALUE: 'golden.business_value',
  // Incident tracking attributes
  INCIDENT_ID: 'golden.incident_id',
  INCIDENT_SEVERITY: 'golden.incident_severity',
  INCIDENT_CHANNEL: 'golden.incident_channel',
  PAGERDUTY_INCIDENT_ID: 'golden.pagerduty_incident_id',
} as const;

export type GoldenComponentType = 'ORCHESTRATOR' | 'REASONER' | 'CONTRACT' | 'EXECUTABLE';

/** Build golden.* span attributes from context and component type (GOS-001). */
export function getGoldenSpanAttributes(
  ctx: GoldenContext,
  componentType: GoldenComponentType,
  options?: { isCompensation?: boolean; businessValue?: string }
): Record<string, string | boolean> {
  const attrs: Record<string, string | boolean> = {
    [GOLDEN_ATTRIBUTES.APP_ID]: ctx.app_id,
    [GOLDEN_ATTRIBUTES.COMPONENT_TYPE]: componentType,
    [GOLDEN_ATTRIBUTES.DATA_CLASSIFICATION]: ctx.data_classification ?? 'INTERNAL',
    [GOLDEN_ATTRIBUTES.COST_CENTER]: ctx.cost_center ?? '',
    [GOLDEN_ATTRIBUTES.INITIATOR_ID]: ctx.initiator_id,
    [GOLDEN_ATTRIBUTES.IS_COMPENSATION]: options?.isCompensation ?? false,
  };
  if (options?.businessValue != null) attrs[GOLDEN_ATTRIBUTES.BUSINESS_VALUE] = options.businessValue;

  // Add incident tracking attributes when present
  if (ctx.incident_id) {
    attrs[GOLDEN_ATTRIBUTES.INCIDENT_ID] = ctx.incident_id;
  }
  if (ctx.incident_severity) {
    attrs[GOLDEN_ATTRIBUTES.INCIDENT_SEVERITY] = ctx.incident_severity;
  }
  if (ctx.incident_channel) {
    attrs[GOLDEN_ATTRIBUTES.INCIDENT_CHANNEL] = ctx.incident_channel;
  }
  if (ctx.pagerduty_incident_id) {
    attrs[GOLDEN_ATTRIBUTES.PAGERDUTY_INCIDENT_ID] = ctx.pagerduty_incident_id;
  }

  return attrs;
}

/**
 * Run fn inside an OTel span with golden.* attributes. Use in activity/Node code (not workflow).
 */
export async function withGoldenSpan<T>(
  name: string,
  ctx: GoldenContext,
  componentType: GoldenComponentType,
  fn: (span: Span) => Promise<T>,
  options?: { isCompensation?: boolean }
): Promise<T> {
  const tracer = trace.getTracer(TRACER_NAME, TRACER_VERSION);
  const span = tracer.startSpan(name, {
    attributes: getGoldenSpanAttributes(ctx, componentType, options),
  });
  try {
    const result = await fn(span);
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (err) {
    span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
    span.recordException(err as Error);
    throw err;
  } finally {
    span.end();
  }
}
