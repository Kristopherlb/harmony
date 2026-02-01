/**
 * packages/tools/workbench-server/src/workbench-security.test.ts
 * TDD: proxy hardening behavior (SSRF, header filtering, rate limiting, concurrency).
 */
import { describe, it, expect } from 'vitest';
import { createWorkbenchServer } from './server.js';

const ORIGIN = 'http://localhost:3000';

describe('Workbench proxy hardening', () => {
  it('rejects REST proxy attempts with absolute URL paths', async () => {
    const server = createWorkbenchServer({
      port: 0,
      testHooks: {
        authenticate: async () => ({
          initiatorId: 'user:1',
          roles: ['provider:github', 'workbench:rest:read'],
          environment: 'local',
        }),
        tokenForProvider: async () => 'token',
        providerRest: async () => ({ status: 200, headers: {}, body: { ok: true } }),
      },
    });
    await server.listen();
    try {
      const create = await fetch(`${server.address()}/workbench/sessions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: ORIGIN },
        body: JSON.stringify({ provider: 'github', kind: 'openapi', mode: 'embedded' }),
      });
      const { sessionId } = (await create.json()) as { sessionId: string };

      const res = await fetch(`${server.address()}/workbench/proxy/rest`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: ORIGIN },
        body: JSON.stringify({ sessionId, method: 'GET', path: 'https://evil.com/' }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('INPUT_VALIDATION_FAILED');
    } finally {
      await server.close();
    }
  });

  it('filters sensitive headers from REST proxy responses', async () => {
    const server = createWorkbenchServer({
      port: 0,
      testHooks: {
        authenticate: async () => ({
          initiatorId: 'user:1',
          roles: ['provider:github', 'workbench:rest:read'],
          environment: 'local',
        }),
        tokenForProvider: async () => 'token',
        providerRest: async () => ({
          status: 200,
          headers: {
            authorization: 'Bearer leaked',
            'set-cookie': 'x=y',
            'content-type': 'application/json',
          },
          body: { ok: true },
        }),
      },
    });
    await server.listen();
    try {
      const create = await fetch(`${server.address()}/workbench/sessions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: ORIGIN },
        body: JSON.stringify({ provider: 'github', kind: 'openapi', mode: 'embedded' }),
      });
      const { sessionId } = (await create.json()) as { sessionId: string };

      const res = await fetch(`${server.address()}/workbench/proxy/rest`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: ORIGIN },
        body: JSON.stringify({ sessionId, method: 'GET', path: '/rate_limit' }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as unknown;
      expect(body && typeof body === 'object').toBe(true);
      const rec = body as Record<string, unknown>;
      const headers = rec.headers as Record<string, unknown>;
      expect(headers.authorization).toBeUndefined();
      expect(headers['set-cookie']).toBeUndefined();
      expect(headers['content-type']).toBe('application/json');
    } finally {
      await server.close();
    }
  });

  it('allows Jira REST proxy calls against allowlisted Atlassian gateway host', async () => {
    const server = createWorkbenchServer({
      port: 0,
      testHooks: {
        authenticate: async () => ({
          initiatorId: 'user:1',
          roles: ['provider:jira', 'workbench:rest:read'],
          environment: 'local',
        }),
        tokenForProvider: async () => 'token',
        providerRest: async ({ url }) => ({
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: { ok: true, url },
        }),
      },
    });
    await server.listen();
    try {
      const create = await fetch(`${server.address()}/workbench/sessions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: ORIGIN },
        body: JSON.stringify({ provider: 'jira', kind: 'openapi', mode: 'embedded' }),
      });
      expect(create.status).toBe(200);
      const { sessionId } = (await create.json()) as { sessionId: string };

      const res = await fetch(`${server.address()}/workbench/proxy/rest`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: ORIGIN },
        body: JSON.stringify({ sessionId, method: 'GET', path: '/ex/jira/cloudid/rest/api/3/myself' }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body?.status).toBe(200);
      expect(body?.body?.ok).toBe(true);
      expect(String(body?.body?.url ?? '')).toContain('api.atlassian.com');
    } finally {
      await server.close();
    }
  });

  it('enforces session binding (user cannot use another user session)', async () => {
    let user = 'user:1';
    const server = createWorkbenchServer({
      port: 0,
      testHooks: {
        authenticate: async () => ({
          initiatorId: user,
          roles: ['provider:github', 'workbench:graphql:query'],
          environment: 'local',
        }),
        tokenForProvider: async () => 'token',
        providerGraphql: async () => ({ data: { ok: true } }),
      },
    });
    await server.listen();
    try {
      const create = await fetch(`${server.address()}/workbench/sessions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: ORIGIN },
        body: JSON.stringify({ provider: 'github', kind: 'graphql', mode: 'embedded' }),
      });
      const { sessionId } = (await create.json()) as { sessionId: string };

      user = 'user:2';
      const res = await fetch(`${server.address()}/workbench/proxy/graphql`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: ORIGIN },
        body: JSON.stringify({ sessionId, query: 'query Ping { __typename }' }),
      });
      expect(res.status).toBe(403);
    } finally {
      await server.close();
    }
  });

  it('rate-limits excessive requests per user', async () => {
    const prev = process.env.WORKBENCH_RATE_LIMIT_PER_MINUTE;
    process.env.WORKBENCH_RATE_LIMIT_PER_MINUTE = '2';

    const server = createWorkbenchServer({
      port: 0,
      testHooks: {
        authenticate: async () => ({
          initiatorId: 'user:1',
          roles: ['provider:github', 'workbench:graphql:query'],
          environment: 'local',
        }),
        tokenForProvider: async () => 'token',
        providerGraphql: async () => ({ data: { ok: true } }),
      },
    });
    await server.listen();
    try {
      const mk = () =>
        fetch(`${server.address()}/workbench/sessions`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', origin: ORIGIN },
          body: JSON.stringify({ provider: 'github', kind: 'graphql', mode: 'embedded' }),
        });
      expect((await mk()).status).toBe(200);
      expect((await mk()).status).toBe(200);
      expect((await mk()).status).toBe(429);
    } finally {
      await server.close();
      if (prev === undefined) delete process.env.WORKBENCH_RATE_LIMIT_PER_MINUTE;
      else process.env.WORKBENCH_RATE_LIMIT_PER_MINUTE = prev;
    }
  });

  it('limits concurrent in-flight requests per user', async () => {
    const prev = process.env.WORKBENCH_CONCURRENCY_PER_USER;
    process.env.WORKBENCH_CONCURRENCY_PER_USER = '1';

    let gateResolve: (() => void) | undefined;
    const gate = new Promise<void>((r) => {
      gateResolve = r;
    });

    const server = createWorkbenchServer({
      port: 0,
      testHooks: {
        authenticate: async () => ({
          initiatorId: 'user:1',
          roles: ['provider:github', 'workbench:graphql:query'],
          environment: 'local',
        }),
        tokenForProvider: async () => 'token',
        providerGraphql: async () => {
          await gate;
          return { data: { ok: true } };
        },
      },
    });
    await server.listen();
    try {
      const create = await fetch(`${server.address()}/workbench/sessions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: ORIGIN },
        body: JSON.stringify({ provider: 'github', kind: 'graphql', mode: 'embedded' }),
      });
      const { sessionId } = (await create.json()) as { sessionId: string };

      const call = () =>
        fetch(`${server.address()}/workbench/proxy/graphql`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', origin: ORIGIN },
          body: JSON.stringify({ sessionId, query: 'query Ping { __typename }' }),
        });

      const p1 = call();
      const p2 = call();
      const r2 = await p2;
      expect(r2.status).toBe(429);
      gateResolve?.();
      expect((await p1).status).toBe(200);
    } finally {
      await server.close();
      if (prev === undefined) delete process.env.WORKBENCH_CONCURRENCY_PER_USER;
      else process.env.WORKBENCH_CONCURRENCY_PER_USER = prev;
    }
  });

  it('does not reflect untrusted kind into launch HTML (kind must match session)', async () => {
    const server = createWorkbenchServer({
      port: 0,
      testHooks: {
        authenticate: async () => ({
          initiatorId: 'user:1',
          roles: ['provider:github', 'workbench:launch'],
          environment: 'local',
        }),
        tokenForProvider: async () => 'token',
        providerRest: async () => ({ status: 200, headers: {}, body: { ok: true } }),
      },
    });
    await server.listen();
    try {
      const create = await fetch(`${server.address()}/workbench/sessions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: ORIGIN },
        body: JSON.stringify({ provider: 'github', kind: 'graphql', mode: 'launch' }),
      });
      expect(create.status).toBe(200);
      const { sessionId } = (await create.json()) as { sessionId: string };

      const badKind = '%3Cscript%3Ealert(1)%3C%2Fscript%3E';
      const res = await fetch(`${server.address()}/workbench/launch/${badKind}?sessionId=${sessionId}`, { method: 'GET' });
      expect(res.status).toBe(404);
      const text = await res.text();
      expect(text).not.toContain('<script>');

      const okRes = await fetch(`${server.address()}/workbench/launch/graphql?sessionId=${sessionId}`, { method: 'GET' });
      expect(okRes.status).toBe(200);
      const csp = okRes.headers.get('content-security-policy') ?? '';
      expect(csp).toContain("default-src 'self'");
      expect(csp).not.toMatch(new RegExp('https?://', 'i'));
    } finally {
      await server.close();
    }
  });
});
