/**
 * packages/tools/workbench-server/src/server.test.ts
 */
import { describe, it, expect } from 'vitest';
import { createWorkbenchServer } from './server.js';

describe('createWorkbenchServer', () => {
  it('returns 404 JSON for unknown routes', async () => {
    const s = createWorkbenchServer({
      port: 0,
      testHooks: {
        authenticate: async () => ({ initiatorId: 'user:1', roles: [], environment: 'local' }),
        tokenForProvider: async () => 'token',
        providerGraphql: async () => ({ data: { ok: true } }),
      },
    });
    await s.listen();
    try {
      const res = await fetch(`${s.address()}/nope`);
      expect(res.status).toBe(404);
      expect(res.headers.get('content-type')).toContain('application/json');
      const body = await res.json();
      expect(body).toEqual({ error: 'NOT_FOUND' });
    } finally {
      await s.close();
    }
  });

  it('exposes a health endpoint', async () => {
    const s = createWorkbenchServer({
      port: 0,
      testHooks: {
        authenticate: async () => ({ initiatorId: 'user:1', roles: [], environment: 'local' }),
        tokenForProvider: async () => 'token',
        providerGraphql: async () => ({ data: { ok: true } }),
      },
    });
    await s.listen();
    try {
      const res = await fetch(`${s.address()}/workbench/health`);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('application/json');
      const body = await res.json();
      expect(body).toEqual({ ok: true });
    } finally {
      await s.close();
    }
  });
});

