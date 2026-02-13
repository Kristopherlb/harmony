/**
 * packages/blueprints/src/worker/secret-broker.test.ts
 * TDD: ISS-001 secretRefs are late-bound to Dagger Secrets at execution time.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveSecretRefs } from './secret-broker.js';

describe('resolveSecretRefs', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('resolves OpenBao secret refs to Dagger secrets via dag.setSecret', async () => {
    const fetchMock = vi.fn(async () => {
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ data: { data: { value: 's3cr3t' } } }),
      } as any;
    });
    global.fetch = fetchMock as any;

    const setSecretCalls: Array<{ name: string; value: string }> = [];
    const dag = {
      setSecret: (name: string, value: string) => {
        setSecretCalls.push({ name, value });
        return { __dagger_secret__: name };
      },
    };

    const resolved = await resolveSecretRefs({
      dag,
      appId: 'console',
      secretRefs: {
        jiraApiToken: '/artifacts/console/public/secrets/jira_api_token',
      },
      openBao: { address: 'http://localhost:8200', mount: 'secret', auth: { token: 'root' } },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(setSecretCalls).toEqual([
      expect.objectContaining({ name: expect.stringContaining('jiraApiToken'), value: 's3cr3t' }),
    ]);
    expect(resolved).toEqual({
      jiraApiToken: { __dagger_secret__: expect.any(String) },
    });
  });

  it('supports OpenBao AppRole auth (logs in once and caches the client token)', async () => {
    const fetchMock = vi.fn(async (url: string, init: any) => {
      if (String(url).includes('/v1/auth/approle/login')) {
        expect(init?.method).toBe('POST');
        const body = JSON.parse(String(init?.body ?? '{}'));
        expect(body).toMatchObject({ role_id: 'role-1', secret_id: 'secret-1' });
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({ auth: { client_token: 't-approle', lease_duration: 3600 } }),
        } as any;
      }

      // KV v2 read
      expect(init?.headers?.['X-Vault-Token']).toBe('t-approle');
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ data: { data: { value: 's3cr3t' } } }),
      } as any;
    });
    global.fetch = fetchMock as any;

    const dag = {
      setSecret: (name: string, value: string) => ({ __dagger_secret__: name, __value__: value }),
    };

    const openBao = {
      address: 'http://localhost:8200',
      mount: 'secret',
      auth: { approle: { roleId: 'role-1', secretId: 'secret-1' } },
    } as any;

    // First resolution should login + read.
    await resolveSecretRefs({
      dag,
      appId: 'console',
      secretRefs: { token: '/artifacts/console/public/secrets/github.token' },
      openBao,
    });

    // Second resolution should NOT login again (cached token).
    await resolveSecretRefs({
      dag,
      appId: 'console',
      secretRefs: { token: '/artifacts/console/public/secrets/github.token' },
      openBao,
    });

    const loginCalls = fetchMock.mock.calls.filter(([u]) => String(u).includes('/v1/auth/approle/login'));
    expect(loginCalls.length).toBe(1);
  });

  it('treats non-ref strings as legacy plaintext values (back-compat)', async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as any;

    const setSecretCalls: Array<{ name: string; value: string }> = [];
    const dag = {
      setSecret: (name: string, value: string) => {
        setSecretCalls.push({ name, value });
        return { __dagger_secret__: name };
      },
    };

    const resolved = await resolveSecretRefs({
      dag,
      appId: 'console',
      secretRefs: { legacy: 'plaintext-value' },
      openBao: { address: 'http://localhost:8200', mount: 'secret', auth: { token: 'root' } },
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(setSecretCalls).toEqual([
      expect.objectContaining({ name: expect.stringContaining('legacy'), value: 'plaintext-value' }),
    ]);
    expect(resolved.legacy).toEqual({ __dagger_secret__: expect.any(String) });
  });

  it('rejects refs that contain .. path segments (ref traversal hardening)', async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as any;

    const dag = {
      setSecret: (name: string, value: string) => ({ __dagger_secret__: name, __value__: value }),
    };

    await expect(
      resolveSecretRefs({
        dag,
        appId: 'console',
        secretRefs: { bad: '/artifacts/console/public/secrets/../github.token' },
        openBao: { address: 'http://localhost:8200', mount: 'secret', auth: { token: 'root' } },
      })
    ).rejects.toThrow(/SECRET_REF_INVALID/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not include OpenBao response body in thrown errors (redaction)', async () => {
    const fetchMock = vi.fn(async () => {
      return {
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: async () => 'do-not-leak-this-secret-value',
      } as any;
    });
    global.fetch = fetchMock as any;

    const dag = {
      setSecret: (name: string, value: string) => ({ __dagger_secret__: name, __value__: value }),
    };

    await expect(
      resolveSecretRefs({
        dag,
        appId: 'console',
        secretRefs: { token: '/artifacts/console/public/secrets/github.token' },
        openBao: { address: 'http://localhost:8200', mount: 'secret', auth: { token: 'root' } },
      })
    ).rejects.not.toThrow(/do-not-leak-this-secret-value/i);
  });
});

