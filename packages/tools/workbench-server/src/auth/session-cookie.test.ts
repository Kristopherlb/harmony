/**
 * packages/tools/workbench-server/src/auth/session-cookie.test.ts
 */
import { describe, it, expect } from 'vitest';
import { parseCookieHeader, parseSessionCookie, serializeSessionCookie } from './session-cookie.js';

describe('session cookie', () => {
  it('round-trips a signed cookie payload', () => {
    const cfg = { name: 'workbench_session', hmacSecret: 'secret' };
    const value = serializeSessionCookie({
      cfg,
      principal: { initiatorId: 'user:1', roles: ['a'], environment: 'local' },
      ttlSeconds: 60,
    });
    const p = parseSessionCookie({ cfg, value });
    expect(p?.initiatorId).toBe('user:1');
    expect(p?.roles).toEqual(['a']);
  });

  it('parses cookie header', () => {
    const map = parseCookieHeader('a=b; c=d');
    expect(map.a).toBe('b');
    expect(map.c).toBe('d');
  });
});

