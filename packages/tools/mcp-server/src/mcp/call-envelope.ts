/**
 * packages/tools/mcp-server/src/mcp/call-envelope.ts
 * Signed call envelope for tools/call (prevents spoofing of caller context).
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export type DataClassification = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';

export interface GoldenCallerContext {
  initiatorId: string;
  roles: string[];
  tokenRef?: string;
  appId?: string;
  environment?: string;
  costCenter?: string;
  dataClassification?: DataClassification;
  traceId?: string;
}

export interface SignedGoldenCallEnvelope {
  alg: 'HMAC-SHA256';
  payload: GoldenCallerContext;
  sig: string; // base64url(HMAC_SHA256(secret, stableStringify(payload)))
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stableStringify(value: unknown): string {
  if (value === null) return 'null';
  const t = typeof value;
  if (t === 'string') return JSON.stringify(value);
  if (t === 'number') return Number.isFinite(value) ? String(value) : JSON.stringify(null);
  if (t === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(',')}]`;
  if (isObject(value)) {
    const keys = Object.keys(value).sort((a, b) => a.localeCompare(b));
    const body = keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',');
    return `{${body}}`;
  }
  return JSON.stringify(null);
}

function base64url(input: Buffer): string {
  return input
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function safeTimingEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

export function signGoldenCallEnvelope(payload: GoldenCallerContext, hmacSecret: string): SignedGoldenCallEnvelope {
  const msg = stableStringify(payload);
  const sig = base64url(createHmac('sha256', hmacSecret).update(msg).digest());
  return { alg: 'HMAC-SHA256', payload, sig };
}

export function verifyGoldenCallEnvelope(
  envelope: unknown,
  hmacSecret: string
): { ok: true; context: GoldenCallerContext } | { ok: false; error: string } {
  if (!isObject(envelope)) return { ok: false, error: 'ENVELOPE_INVALID' };
  if (envelope.alg !== 'HMAC-SHA256') return { ok: false, error: 'ENVELOPE_UNSUPPORTED_ALG' };
  const payload = envelope.payload;
  const sig = envelope.sig;
  if (!isObject(payload)) return { ok: false, error: 'ENVELOPE_INVALID_PAYLOAD' };
  if (typeof sig !== 'string' || sig.length === 0) return { ok: false, error: 'ENVELOPE_INVALID_SIGNATURE' };
  if (typeof payload.initiatorId !== 'string' || payload.initiatorId.trim().length === 0) {
    return { ok: false, error: 'ENVELOPE_INVALID_INITIATOR' };
  }
  if (!Array.isArray(payload.roles) || payload.roles.some((r: unknown) => typeof r !== 'string')) {
    return { ok: false, error: 'ENVELOPE_INVALID_ROLES' };
  }
  const msg = stableStringify(payload);
  const expected = base64url(createHmac('sha256', hmacSecret).update(msg).digest());
  if (!safeTimingEqual(expected, sig)) return { ok: false, error: 'ENVELOPE_SIGNATURE_MISMATCH' };
  const context: GoldenCallerContext = {
    initiatorId: String(payload.initiatorId),
    roles: (payload.roles as unknown[]).map((r) => String(r)),
    tokenRef: typeof payload.tokenRef === 'string' ? payload.tokenRef : undefined,
    appId: typeof payload.appId === 'string' ? payload.appId : undefined,
    environment: typeof payload.environment === 'string' ? payload.environment : undefined,
    costCenter: typeof payload.costCenter === 'string' ? payload.costCenter : undefined,
    dataClassification: typeof payload.dataClassification === 'string' ? (payload.dataClassification as DataClassification) : undefined,
    traceId: typeof payload.traceId === 'string' ? payload.traceId : undefined,
  };
  return { ok: true, context };
}

