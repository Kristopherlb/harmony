/**
 * packages/core/src/auth/openbao-kv.ts
 * Shared OpenBao KV v2 helpers for token/AppRole auth and secret reads.
 */
export type OpenBaoKvConfig = {
  address: string;
  mount: string;
  auth:
    | { token: string }
    | {
        approle: {
          /** auth mount name (default: "approle") */
          mount?: string;
          roleId: string;
          secretId: string;
        };
      };
};

let cachedOpenBaoToken:
  | { address: string; mount: string; authMount: string; roleId: string; token: string; expiresAtMs?: number }
  | undefined;

function normalizeRef(ref: string): string {
  return ref.replace(/^\/+/, '');
}

function joinUrl(base: string, path: string): string {
  const b = base.replace(/\/+$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}${p}`;
}

export function assertValidSecretRef(ref: string): void {
  if (!ref.startsWith('/')) throw new Error('SECRET_REF_INVALID');
  const rel = normalizeRef(ref);
  const segments = rel.split('/').filter((s) => s.length > 0);
  if (segments.some((s) => s === '..')) throw new Error('SECRET_REF_INVALID');
}

export function extractValueFromKvData(data: unknown): string {
  if (!data || typeof data !== 'object') {
    throw new Error('OpenBao KV response missing data');
  }
  const obj = data as Record<string, unknown>;
  const direct = obj.value;
  if (typeof direct === 'string') return direct;

  const stringEntries = Object.entries(obj).filter(([, v]) => typeof v === 'string') as Array<[string, string]>;
  if (stringEntries.length === 1) return stringEntries[0]![1];

  throw new Error('OpenBao secret did not contain a single string value');
}

export async function resolveOpenBaoToken(opts: {
  openBao: OpenBaoKvConfig;
  fetchImpl?: typeof fetch;
  nowMs?: number;
}): Promise<string> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const nowMs = opts.nowMs ?? Date.now();
  const { openBao } = opts;

  if ('token' in openBao.auth) return openBao.auth.token;

  const authMount = openBao.auth.approle.mount ?? 'approle';
  const roleId = openBao.auth.approle.roleId;
  const secretId = openBao.auth.approle.secretId;

  if (
    cachedOpenBaoToken &&
    cachedOpenBaoToken.address === openBao.address &&
    cachedOpenBaoToken.mount === openBao.mount &&
    cachedOpenBaoToken.authMount === authMount &&
    cachedOpenBaoToken.roleId === roleId &&
    (!cachedOpenBaoToken.expiresAtMs || nowMs < cachedOpenBaoToken.expiresAtMs)
  ) {
    return cachedOpenBaoToken.token;
  }

  const url = joinUrl(openBao.address, `/v1/auth/${authMount}/login`);
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ role_id: roleId, secret_id: secretId }),
  });
  if (!res.ok) throw new Error(`OPENBAO_LOGIN_FAILED (${res.status})`);

  const json = (await res.json()) as any;
  const token = String(json?.auth?.client_token ?? '');
  if (!token) throw new Error('OPENBAO_LOGIN_TOKEN_MISSING');

  const leaseSeconds = Number(json?.auth?.lease_duration);
  const expiresAtMs =
    Number.isFinite(leaseSeconds) && leaseSeconds > 0 ? nowMs + Math.floor(leaseSeconds * 1000 * 0.9) : undefined;

  cachedOpenBaoToken = { address: openBao.address, mount: openBao.mount, authMount, roleId, token, expiresAtMs };
  return token;
}

export async function readOpenBaoKvV2SecretValue(opts: {
  openBao: OpenBaoKvConfig;
  secretRef: string;
  fetchImpl?: typeof fetch;
}): Promise<string> {
  assertValidSecretRef(opts.secretRef);
  const fetchImpl = opts.fetchImpl ?? fetch;
  const token = await resolveOpenBaoToken({ openBao: opts.openBao, fetchImpl });
  const rel = normalizeRef(opts.secretRef);
  const url = joinUrl(opts.openBao.address, `/v1/${opts.openBao.mount}/data/${rel}`);

  const res = await fetchImpl(url, {
    method: 'GET',
    headers: { 'X-Vault-Token': token, Accept: 'application/json' },
  });
  if (!res.ok) {
    // Redaction guarantee: do not include response body in thrown error messages.
    throw new Error(`OPENBAO_READ_FAILED (${res.status})`);
  }
  const json = (await res.json()) as any;
  const data = json?.data?.data;
  return extractValueFromKvData(data);
}

