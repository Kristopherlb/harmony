/**
 * packages/tools/workbench-server/src/secrets/openbao.ts
 * Minimal OpenBao (Vault-compatible) secret reader for Workbench provider tokens.
 *
 * This implementation is intentionally conservative:
 * - only supports read (no writes)
 * - never logs secret values
 */
import { buildOpenBaoPath, type GoldenContext } from '@golden/core';

export interface OpenBaoClientOptions {
  address: string;
  token: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function extractOpenBaoSecretValue(payload: unknown): string | undefined {
  // Support a few common shapes without assuming a specific engine:
  // - KV v1: { data: { value: "..." } } or { data: { token: "..." } }
  // - KV v2: { data: { data: { value: "..." } } }
  if (!isRecord(payload)) return undefined;
  const d1 = payload['data'];
  if (!isRecord(d1)) return undefined;
  const direct = d1['value'] ?? d1['token'];
  if (typeof direct === 'string' && direct.length > 0) return direct;
  const d2 = d1['data'];
  if (!isRecord(d2)) return undefined;
  const v2 = d2['value'] ?? d2['token'];
  if (typeof v2 === 'string' && v2.length > 0) return v2;
  return undefined;
}

export function createOpenBaoClient(options: OpenBaoClientOptions) {
  const base = options.address.replace(/\/+$/, '');

  return {
    async readSecret(path: string): Promise<string> {
      const normalized = path.startsWith('/') ? path : `/${path}`;
      const url = `${base}/v1${normalized}`;
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'x-vault-token': options.token,
          accept: 'application/json',
        },
      });
      if (!res.ok) {
        throw new Error(`OPENBAO_READ_FAILED (${res.status})`);
      }
      const json = (await res.json()) as unknown;
      const value = extractOpenBaoSecretValue(json);
      if (!value) throw new Error('OPENBAO_SECRET_VALUE_MISSING');
      return value;
    },
  };
}

export function workbenchProviderTokenSecretName(provider: string): string {
  return `${provider}.token`;
}

export async function resolveProviderTokenFromOpenBao(input: {
  openbao: ReturnType<typeof createOpenBaoClient>;
  ctx: GoldenContext;
  provider: string;
  scope: 'user' | 'public';
}): Promise<string> {
  const secretName = workbenchProviderTokenSecretName(input.provider);
  const path = buildOpenBaoPath(input.ctx, secretName, input.scope);
  return await input.openbao.readSecret(path);
}
