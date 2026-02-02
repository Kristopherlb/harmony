/**
 * packages/blueprints/src/worker/secret-broker.ts
 *
 * Purpose: Resolve ISS-001 `secretRefs` into Dagger Secrets at runtime.
 *
 * - Callers pass secretRefs as references (e.g. OpenBao paths like `/artifacts/...`).
 * - The worker late-binds them by fetching values and calling `dag.setSecret(...)`.
 * - For backwards compatibility, non-ref strings are treated as plaintext and wrapped as Dagger Secrets.
 */
export type OpenBaoKvConfig = {
  /** Base address, e.g. http://localhost:8200 */
  address: string;
  /** Vault/OpenBao token */
  token: string;
  /** KV mount name, e.g. "secret" */
  mount: string;
};

type DaggerClientLike = {
  setSecret(name: string, value: string): unknown;
};

function isRefString(value: string): boolean {
  // ISS-001 uses hierarchical absolute paths (e.g. /artifacts/{appId}/...).
  return value.startsWith('/');
}

function normalizeRef(ref: string): string {
  return ref.replace(/^\/+/, '');
}

function joinUrl(base: string, path: string): string {
  const b = base.replace(/\/+$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}${p}`;
}

function extractValueFromKvData(data: unknown): string {
  if (!data || typeof data !== 'object') {
    throw new Error('OpenBao KV response missing data');
  }
  const obj = data as Record<string, unknown>;
  const direct = obj.value;
  if (typeof direct === 'string') return direct;

  // If only one string field exists, treat it as the secret value.
  const stringEntries = Object.entries(obj).filter(([, v]) => typeof v === 'string') as Array<
    [string, string]
  >;
  if (stringEntries.length === 1) return stringEntries[0]![1];

  throw new Error('OpenBao secret did not contain a single string value');
}

async function readOpenBaoKvV2Value(opts: {
  fetchImpl: typeof fetch;
  openBao: OpenBaoKvConfig;
  ref: string;
}): Promise<string> {
  const { fetchImpl, openBao } = opts;
  const rel = normalizeRef(opts.ref);
  const url = joinUrl(openBao.address, `/v1/${openBao.mount}/data/${rel}`);

  const res = await fetchImpl(url, {
    method: 'GET',
    headers: { 'X-Vault-Token': openBao.token, Accept: 'application/json' },
  });
  if (!res.ok) {
    const text = (await res.text().catch(() => '')) || res.statusText;
    throw new Error(`OpenBao read failed (${res.status}): ${text}`);
  }
  const json = (await res.json()) as any;
  const kvData = json?.data?.data;
  return extractValueFromKvData(kvData);
}

export async function resolveSecretRefs(opts: {
  dag: unknown;
  appId: string;
  secretRefs: Record<string, unknown>;
  openBao: OpenBaoKvConfig;
  fetchImpl?: typeof fetch;
}): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  const fetchImpl = opts.fetchImpl ?? fetch;
  const d = opts.dag as unknown as Partial<DaggerClientLike>;

  for (const [key, value] of Object.entries(opts.secretRefs ?? {})) {
    if (value === undefined || value === null) continue;

    // Already a runtime secret object → pass through.
    if (typeof value !== 'string') {
      out[key] = value;
      continue;
    }

    if (typeof d.setSecret !== 'function') {
      // No way to late-bind without Dagger secret support. Preserve value.
      out[key] = value;
      continue;
    }

    if (isRefString(value)) {
      const secretValue = await readOpenBaoKvV2Value({
        fetchImpl,
        openBao: opts.openBao,
        ref: value,
      });
      out[key] = d.setSecret(`${opts.appId}-${key}`, secretValue);
      continue;
    }

    // Back-compat: treat as plaintext secret.
    out[key] = d.setSecret(`${opts.appId}-${key}`, value);
  }

  return out;
}

