/**
 * packages/tools/workbench-server/src/auth/session-endpoint.test.ts
 * TDD: minting a browser session cookie from Bearer auth.
 *
 * Note: We don't stand up real OIDC in unit tests; this verifies gating and headers only.
 */
import { describe, it, expect } from 'vitest';
import { createWorkbenchServer } from '../server.js';

const ORIGIN = 'http://localhost:3000';

describe('POST /workbench/auth/session', () => {
  it('returns 500 when cookie HMAC secret not configured', async () => {
    const prev = process.env.WORKBENCH_SESSION_HMAC_SECRET;
    delete process.env.WORKBENCH_SESSION_HMAC_SECRET;

    const server = createWorkbenchServer({
      port: 0,
      testHooks: {
        // In tests, authenticate() returns a principal but we still require OIDC auth for minting cookies.
        authenticate: async () => ({ initiatorId: 'user:1', roles: [], environment: 'local' }),
      },
    });
    await server.listen();
    try {
      const res = await fetch(`${server.address()}/workbench/auth/session`, {
        method: 'POST',
        headers: { origin: ORIGIN },
      });
      expect(res.status).toBe(500);
    } finally {
      await server.close();
      if (prev !== undefined) process.env.WORKBENCH_SESSION_HMAC_SECRET = prev;
    }
  });
});

