/**
 * packages/core/src/wcs/security-context.ts
 * Security context injected by platform (WCS 2.3).
 */
export interface SecurityContext {
  initiatorId: string;
  roles: string[];
  tokenRef: string;
  /** OTel trace_id propagated from request; used for correlation (GOS). */
  traceId?: string;
}
