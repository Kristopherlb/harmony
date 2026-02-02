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
      openBao: { address: 'http://localhost:8200', token: 'root', mount: 'secret' },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(setSecretCalls).toEqual([
      expect.objectContaining({ name: expect.stringContaining('jiraApiToken'), value: 's3cr3t' }),
    ]);
    expect(resolved).toEqual({
      jiraApiToken: { __dagger_secret__: expect.any(String) },
    });
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
      openBao: { address: 'http://localhost:8200', token: 'root', mount: 'secret' },
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(setSecretCalls).toEqual([
      expect.objectContaining({ name: expect.stringContaining('legacy'), value: 'plaintext-value' }),
    ]);
    expect(resolved.legacy).toEqual({ __dagger_secret__: expect.any(String) });
  });
});

