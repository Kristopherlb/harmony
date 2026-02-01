/**
 * packages/tools/workbench-server/src/launch-ui.test.ts
 */
import { describe, it, expect } from 'vitest';
import { createWorkbenchServer } from './server.js';

const ORIGIN = 'http://localhost:3000';

describe('Workbench launch UI', () => {
  it('returns launch HTML with CSP even without a session (session is created invisibly in UI)', async () => {
    const prevDev = process.env.WORKBENCH_DEV_AUTH;
    process.env.WORKBENCH_DEV_AUTH = 'true';

    const server = createWorkbenchServer({
      port: 0,
      testHooks: {
        // keep provider stubs so we don't require OpenBao in tests
        tokenForProvider: async () => 'token',
        providerRest: async () => ({ status: 200, headers: {}, body: { ok: true } }),
      },
    });
    await server.listen();
    try {
      const noSession = await fetch(`${server.address()}/workbench/launch/graphql?provider=github`);
      expect(noSession.status).toBe(200);
      expect(noSession.headers.get('content-type')).toContain('text/html');

      const create = await fetch(`${server.address()}/workbench/sessions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: ORIGIN },
        body: JSON.stringify({ provider: 'github', kind: 'graphql', mode: 'launch' }),
      });
      expect(create.status).toBe(200);
      const { sessionId } = (await create.json()) as { sessionId: string };

      const ok = await fetch(`${server.address()}/workbench/launch/graphql?sessionId=${sessionId}`);
      expect(ok.status).toBe(200);
      expect(ok.headers.get('content-type')).toContain('text/html');
      const csp = ok.headers.get('content-security-policy') ?? '';
      expect(csp).toContain("default-src 'self'");
      expect(csp).not.toMatch(new RegExp('https?://', 'i'));
    } finally {
      await server.close();
      if (prevDev === undefined) delete process.env.WORKBENCH_DEV_AUTH;
      else process.env.WORKBENCH_DEV_AUTH = prevDev;
    }
  });
});

