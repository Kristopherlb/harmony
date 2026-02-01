/**
 * packages/tools/workbench-server/src/auth/session-cookie.ts
 * Signed session cookie for browser-based launch UI.
 *
 * The cookie contains only (initiatorId, roles, environment, exp) and is HMAC-signed.
 * It MUST NOT contain provider tokens.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Principal } from './keycloak.js';

export interface SessionCookieConfig {
  name: string;
  hmacSecret: string;
}

type CookiePayload = Principal & { exp: number };

function base64urlEncode(input: string): string {
  return Buffer.from(input, 'utf8')
    .toString('base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

function base64urlDecode(input: string): string {
  const pad = '='.repeat((4 - (input.length % 4)) % 4);
  const b64 = input.replaceAll('-', '+').replaceAll('_', '/') + pad;
  return Buffer.from(b64, 'base64').toString('utf8');
}

function sign(secret: string, body: string): string {
  return createHmac('sha256', secret).update(body).digest('base64url');
}

export function serializeSessionCookie(input: { cfg: SessionCookieConfig; principal: Principal; ttlSeconds: number }): string {
  const payload: CookiePayload = {
    initiatorId: input.principal.initiatorId,
    roles: input.principal.roles,
    environment: input.principal.environment,
    exp: Math.floor(Date.now() / 1000) + input.ttlSeconds,
  };
  const body = base64urlEncode(JSON.stringify(payload));
  const sig = sign(input.cfg.hmacSecret, body);
  return `${body}.${sig}`;
}

export function parseSessionCookie(input: { cfg: SessionCookieConfig; value: string | undefined }): Principal | undefined {
  if (!input.value) return undefined;
  const parts = input.value.split('.');
  if (parts.length !== 2) return undefined;
  const [body, sig] = parts;
  if (!body || !sig) return undefined;

  const expected = sign(input.cfg.hmacSecret, body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return undefined;
  if (!timingSafeEqual(a, b)) return undefined;

  let payload: CookiePayload;
  try {
    payload = JSON.parse(base64urlDecode(body)) as CookiePayload;
  } catch {
    return undefined;
  }
  if (!payload || typeof payload.initiatorId !== 'string' || !Array.isArray(payload.roles) || typeof payload.environment !== 'string') {
    return undefined;
  }
  if (typeof payload.exp !== 'number') return undefined;
  if (payload.exp <= Math.floor(Date.now() / 1000)) return undefined;
  return { initiatorId: payload.initiatorId, roles: payload.roles, environment: payload.environment };
}

export function parseCookieHeader(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  const parts = header.split(';');
  for (const part of parts) {
    const [k, ...rest] = part.trim().split('=');
    if (!k) continue;
    out[k] = rest.join('=');
  }
  return out;
}

