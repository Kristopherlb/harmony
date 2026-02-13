/**
 * packages/blueprints/src/worker/secret-broker.ts
 *
 * Purpose: Resolve ISS-001 `secretRefs` into Dagger Secrets at runtime.
 *
 * - Callers pass secretRefs as references (e.g. OpenBao paths like `/artifacts/...`).
 * - The worker late-binds them by fetching values and calling `dag.setSecret(...)`.
 * - For backwards compatibility, non-ref strings are treated as plaintext and wrapped as Dagger Secrets.
 */
import {
  assertValidSecretRef,
  readOpenBaoKvV2SecretValue,
  type OpenBaoKvConfig,
} from '@golden/core';

type DaggerClientLike = {
  setSecret(name: string, value: string): unknown;
};

function isRefString(value: string): boolean {
  // ISS-001 uses hierarchical absolute paths (e.g. /artifacts/{appId}/...).
  return value.startsWith('/');
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
      assertValidSecretRef(value);
      const secretValue = await readOpenBaoKvV2SecretValue({
        openBao: opts.openBao,
        secretRef: value,
        fetchImpl,
      });
      out[key] = d.setSecret(`${opts.appId}-${key}`, secretValue);
      continue;
    }

    // Back-compat: treat as plaintext secret.
    out[key] = d.setSecret(`${opts.appId}-${key}`, value);
  }

  return out;
}

