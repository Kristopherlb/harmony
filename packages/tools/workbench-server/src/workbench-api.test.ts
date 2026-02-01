/**
 * packages/tools/workbench-server/src/workbench-api.test.ts
 * TDD: secure-by-default Workbench API behavior.
 */
import { describe, it, expect, vi } from 'vitest';
import { createWorkbenchServer } from './server.js';

type Principal = { initiatorId: string; roles: string[]; environment: string };

describe('Workbench API (security invariants)', () => {
  it('allows localhost:5000 origin by default in local env', async () => {
    const prev = process.env.WORKBENCH_CORS_ORIGINS;
    delete process.env.WORKBENCH_CORS_ORIGINS;

    const server = createWorkbenchServer({
      port: 0,
      testHooks: {
        authenticate: async () =>
          ({ initiatorId: 'user:1', roles: ['provider:github', 'workbench:launch'], environment: 'local' } satisfies Principal),
        tokenForProvider: async () => 'token',
        providerRest: async () => ({ status: 200, headers: {}, body: { ok: true } }),
      },
    });
    await server.listen();
    try {
      const res = await fetch(`${server.address()}/workbench/sessions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://localhost:5000' },
        body: JSON.stringify({ provider: 'github', kind: 'graphql', mode: 'launch' }),
      });
      expect(res.status).toBe(200);
    } finally {
      await server.close();
      if (prev === undefined) delete process.env.WORKBENCH_CORS_ORIGINS;
      else process.env.WORKBENCH_CORS_ORIGINS = prev;
    }
  });

  it('allows localhost:5000 origin in local dev-auth even when WORKBENCH_CORS_ORIGINS is restrictive', async () => {
    const prevCors = process.env.WORKBENCH_CORS_ORIGINS;
    const prevDev = process.env.WORKBENCH_DEV_AUTH;
    const prevEnv = process.env.WORKBENCH_ENVIRONMENT;
    process.env.WORKBENCH_CORS_ORIGINS = 'http://localhost:3000';
    process.env.WORKBENCH_DEV_AUTH = 'true';
    process.env.WORKBENCH_ENVIRONMENT = 'local';

    const server = createWorkbenchServer({
      port: 0,
      testHooks: {
        authenticate: async () =>
          ({ initiatorId: 'user:1', roles: ['provider:github', 'workbench:launch'], environment: 'local' } satisfies Principal),
        tokenForProvider: async () => 'token',
        providerRest: async () => ({ status: 200, headers: {}, body: { ok: true } }),
      },
    });
    await server.listen();
    try {
      const res = await fetch(`${server.address()}/workbench/sessions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://localhost:5000' },
        body: JSON.stringify({ provider: 'github', kind: 'graphql', mode: 'launch' }),
      });
      expect(res.status).toBe(200);
    } finally {
      await server.close();
      if (prevCors === undefined) delete process.env.WORKBENCH_CORS_ORIGINS;
      else process.env.WORKBENCH_CORS_ORIGINS = prevCors;
      if (prevDev === undefined) delete process.env.WORKBENCH_DEV_AUTH;
      else process.env.WORKBENCH_DEV_AUTH = prevDev;
      if (prevEnv === undefined) delete process.env.WORKBENCH_ENVIRONMENT;
      else process.env.WORKBENCH_ENVIRONMENT = prevEnv;
    }
  });

  it('uses a longer default session TTL in local env', async () => {
    const prevTtl = process.env.WORKBENCH_SESSION_TTL_MS;
    delete process.env.WORKBENCH_SESSION_TTL_MS;

    const now = 1_000_000;
    const spy = vi.spyOn(Date, 'now').mockReturnValue(now);

    const server = createWorkbenchServer({
      port: 0,
      testHooks: {
        authenticate: async () =>
          ({ initiatorId: 'user:1', roles: ['provider:github', 'workbench:launch'], environment: 'local' } satisfies Principal),
        tokenForProvider: async () => 'token',
        providerRest: async () => ({ status: 200, headers: {}, body: { ok: true } }),
      },
    });
    await server.listen();
    try {
      const create = await fetch(`${server.address()}/workbench/sessions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
        body: JSON.stringify({ provider: 'github', kind: 'graphql', mode: 'launch' }),
      });
      expect(create.status).toBe(200);
      const json = (await create.json()) as { expiresAt: string };
      const expiresAtMs = new Date(json.expiresAt).getTime();
      expect(expiresAtMs).toBe(now + 60 * 60 * 1000);
    } finally {
      await server.close();
      spy.mockRestore();
      if (prevTtl === undefined) delete process.env.WORKBENCH_SESSION_TTL_MS;
      else process.env.WORKBENCH_SESSION_TTL_MS = prevTtl;
    }
  });

  it('denies session creation without provider role', async () => {
    const prevDev = process.env.WORKBENCH_DEV_AUTH;
    process.env.WORKBENCH_DEV_AUTH = 'true';

    const server = createWorkbenchServer({
      port: 0,
      testHooks: {
        authenticate: async () => ({ initiatorId: 'user:1', roles: [], environment: 'local' } satisfies Principal),
        tokenForProvider: async () => 'token',
        providerGraphql: async () => ({ data: { ok: true } }),
      },
    });
    await server.listen();
    try {
      const res = await fetch(`${server.address()}/workbench/sessions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
        body: JSON.stringify({ provider: 'github', kind: 'graphql', mode: 'embedded' }),
      });
      expect(res.status).toBe(403);
    } finally {
      await server.close();
      if (prevDev === undefined) delete process.env.WORKBENCH_DEV_AUTH;
      else process.env.WORKBENCH_DEV_AUTH = prevDev;
    }
  });

  it('blocks GraphQL introspection outside local dev', async () => {
    const server = createWorkbenchServer({
      port: 0,
      testHooks: {
        authenticate: async () =>
          ({ initiatorId: 'user:1', roles: ['provider:github', 'workbench:graphql:query'], environment: 'prod' } satisfies Principal),
        tokenForProvider: async () => 'test-token',
        providerGraphql: async () => ({ data: { ok: true } }),
      },
    });
    await server.listen();
    try {
      // Create a session first
      const create = await fetch(`${server.address()}/workbench/sessions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
        body: JSON.stringify({ provider: 'github', kind: 'graphql', mode: 'embedded' }),
      });
      expect(create.status).toBe(200);
      const { sessionId } = (await create.json()) as { sessionId: string };

      const res = await fetch(`${server.address()}/workbench/proxy/graphql`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
        body: JSON.stringify({ sessionId, query: 'query X { __schema { types { name } } }' }),
      });
      expect(res.status).toBe(400);
    } finally {
      await server.close();
    }
  });

  it('allows larger GraphQL documents in local env (dev ergonomics)', async () => {
    const server = createWorkbenchServer({
      port: 0,
      testHooks: {
        authenticate: async () =>
          ({ initiatorId: 'user:1', roles: ['provider:github', 'workbench:graphql:query'], environment: 'local' } satisfies Principal),
        tokenForProvider: async () => 'test-token',
        providerGraphql: async () => ({ data: { ok: true } }),
      },
    });
    await server.listen();
    try {
      const create = await fetch(`${server.address()}/workbench/sessions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
        body: JSON.stringify({ provider: 'github', kind: 'graphql', mode: 'embedded' }),
      });
      expect(create.status).toBe(200);
      const { sessionId } = (await create.json()) as { sessionId: string };

      const fields = Array.from({ length: 3000 }, (_, i) => `f${i}: __typename`).join(' ');
      const query = `query Big { ${fields} }`;

      const res = await fetch(`${server.address()}/workbench/proxy/graphql`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
        body: JSON.stringify({ sessionId, query }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body?.data?.ok).toBe(true);
    } finally {
      await server.close();
    }
  });

  it('supports local dev provider token env var when OpenBao is not configured (GraphQL)', async () => {
    const prevDev = process.env.WORKBENCH_DEV_AUTH;
    const prevEnv = process.env.WORKBENCH_ENVIRONMENT;
    const prevToken = process.env.WORKBENCH_DEV_PROVIDER_TOKEN_GITHUB;
    process.env.WORKBENCH_DEV_AUTH = 'true';
    process.env.WORKBENCH_ENVIRONMENT = 'local';
    process.env.WORKBENCH_DEV_PROVIDER_TOKEN_GITHUB = 'test-token';

    const server = createWorkbenchServer({
      port: 0,
      testHooks: {
        authenticate: async () =>
          ({ initiatorId: 'user:1', roles: ['provider:github', 'workbench:graphql:query'], environment: 'local' } satisfies Principal),
        providerGraphql: async ({ token }) => ({ data: { ok: true, tokenSeen: token } }),
      },
    });
    await server.listen();
    try {
      const create = await fetch(`${server.address()}/workbench/sessions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
        body: JSON.stringify({ provider: 'github', kind: 'graphql', mode: 'embedded' }),
      });
      expect(create.status).toBe(200);
      const { sessionId } = (await create.json()) as { sessionId: string };

      const res = await fetch(`${server.address()}/workbench/proxy/graphql`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
        body: JSON.stringify({ sessionId, query: 'query Ping { __typename }' }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body?.data?.ok).toBe(true);
      expect(body?.data?.tokenSeen).toBe('test-token');
    } finally {
      await server.close();
      if (prevDev === undefined) delete process.env.WORKBENCH_DEV_AUTH;
      else process.env.WORKBENCH_DEV_AUTH = prevDev;
      if (prevEnv === undefined) delete process.env.WORKBENCH_ENVIRONMENT;
      else process.env.WORKBENCH_ENVIRONMENT = prevEnv;
      if (prevToken === undefined) delete process.env.WORKBENCH_DEV_PROVIDER_TOKEN_GITHUB;
      else process.env.WORKBENCH_DEV_PROVIDER_TOKEN_GITHUB = prevToken;
    }
  });

  it('creates an OpenAPI session for Jira and serves the Jira OpenAPI document', async () => {
    const server = createWorkbenchServer({
      port: 0,
      testHooks: {
        authenticate: async () =>
          ({ initiatorId: 'user:1', roles: ['provider:jira', 'workbench:rest:read'], environment: 'local' } satisfies Principal),
        tokenForProvider: async () => 'token',
        providerRest: async () => ({ status: 200, headers: {}, body: { ok: true } }),
      },
    });
    await server.listen();
    try {
      const create = await fetch(`${server.address()}/workbench/sessions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
        body: JSON.stringify({ provider: 'jira', kind: 'openapi', mode: 'embedded' }),
      });
      expect(create.status).toBe(200);
      const { sessionId } = (await create.json()) as { sessionId: string };

      const res = await fetch(
        `${server.address()}/workbench/openapi/jira?sessionId=${encodeURIComponent(sessionId)}`
      );
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('application/json');
      const text = await res.text();
      expect(text).toContain('"openapi"');
    } finally {
      await server.close();
    }
  });

  it('includes provider in launchUrl when WORKBENCH_PUBLIC_BASE_URL is set', async () => {
    const prevBase = process.env.WORKBENCH_PUBLIC_BASE_URL;
    process.env.WORKBENCH_PUBLIC_BASE_URL = 'http://127.0.0.1:8787';

    const server = createWorkbenchServer({
      port: 0,
      testHooks: {
        authenticate: async () =>
          ({ initiatorId: 'user:1', roles: ['provider:jira', 'workbench:launch'], environment: 'local' } satisfies Principal),
        tokenForProvider: async () => 'token',
        providerRest: async () => ({ status: 200, headers: {}, body: { ok: true } }),
      },
    });
    await server.listen();
    try {
      const create = await fetch(`${server.address()}/workbench/sessions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
        body: JSON.stringify({ provider: 'jira', kind: 'openapi', mode: 'launch' }),
      });
      expect(create.status).toBe(200);
      const json = (await create.json()) as any;
      expect(typeof json.launchUrl).toBe('string');
      expect(String(json.launchUrl)).toContain('provider=jira');
    } finally {
      await server.close();
      if (prevBase === undefined) delete process.env.WORKBENCH_PUBLIC_BASE_URL;
      else process.env.WORKBENCH_PUBLIC_BASE_URL = prevBase;
    }
  });
});

