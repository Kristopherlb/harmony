/**
 * packages/core/src/auth/openbao-kv.test.ts
 * TDD: shared OpenBao KV token resolution and secret reads.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  assertValidSecretRef,
  readOpenBaoKvV2SecretValue,
  type OpenBaoKvConfig,
} from './openbao-kv.js';

describe('openbao-kv', () => {
  it('reads KV v2 secret using token auth', async () => {
    const fetchMock = vi.fn(async (_url: string, init: any) => {
      expect(init?.headers?.['X-Vault-Token']).toBe('root-token');
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: { data: { value: 's3cr3t' } } }),
      } as any;
    });

    const openBao: OpenBaoKvConfig = {
      address: 'http://localhost:8200',
      mount: 'secret',
      auth: { token: 'root-token' },
    };

    const value = await readOpenBaoKvV2SecretValue({
      openBao,
      secretRef: '/artifacts/console/public/secrets/github.token',
      fetchImpl: fetchMock as any,
    });
    expect(value).toBe('s3cr3t');
  });

  it('logs in with AppRole once and reuses cached token', async () => {
    const fetchMock = vi.fn(async (url: string, init: any) => {
      if (url.includes('/v1/auth/approle/login')) {
        const body = JSON.parse(String(init?.body ?? '{}'));
        expect(body).toEqual({ role_id: 'role-1', secret_id: 'secret-1' });
        return {
          ok: true,
          status: 200,
          json: async () => ({ auth: { client_token: 'token-approle', lease_duration: 3600 } }),
        } as any;
      }
      expect(init?.headers?.['X-Vault-Token']).toBe('token-approle');
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: { data: { value: 's3cr3t' } } }),
      } as any;
    });

    const openBao: OpenBaoKvConfig = {
      address: 'http://localhost:8200',
      mount: 'secret',
      auth: { approle: { roleId: 'role-1', secretId: 'secret-1' } },
    };

    await readOpenBaoKvV2SecretValue({
      openBao,
      secretRef: '/artifacts/console/public/secrets/a',
      fetchImpl: fetchMock as any,
    });
    await readOpenBaoKvV2SecretValue({
      openBao,
      secretRef: '/artifacts/console/public/secrets/b',
      fetchImpl: fetchMock as any,
    });

    const loginCalls = fetchMock.mock.calls.filter(([u]) => String(u).includes('/v1/auth/approle/login'));
    expect(loginCalls.length).toBe(1);
  });

  it('rejects path traversal refs', () => {
    expect(() => assertValidSecretRef('/artifacts/console/public/secrets/../bad')).toThrow(/SECRET_REF_INVALID/);
  });

  it('does not leak response body in read failures', async () => {
    const fetchMock = vi.fn(async () => {
      return {
        ok: false,
        status: 403,
        text: async () => 'do-not-leak',
      } as any;
    });

    const openBao: OpenBaoKvConfig = {
      address: 'http://localhost:8200',
      mount: 'secret',
      auth: { token: 'root-token' },
    };

    await expect(
      readOpenBaoKvV2SecretValue({
        openBao,
        secretRef: '/artifacts/console/public/secrets/github.token',
        fetchImpl: fetchMock as any,
      })
    ).rejects.not.toThrow(/do-not-leak/i);
  });
});

