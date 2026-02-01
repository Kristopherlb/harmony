/**
 * packages/tools/workbench-server/src/security/ssrf.ts
 * SSRF prevention helpers for REST proxying.
 */
export type SsrfCheckResult = { ok: true; url: URL } | { ok: false; reason: 'INVALID_PATH' | 'ORIGIN_NOT_ALLOWED' };

export function buildAllowlistedUrl(input: { baseUrl: string; path: string; query?: Record<string, string> }): SsrfCheckResult {
  let base: URL;
  try {
    base = new URL(input.baseUrl);
  } catch {
    return { ok: false, reason: 'ORIGIN_NOT_ALLOWED' };
  }

  // Reject any scheme/host injection; `new URL(path, base)` accepts absolute URLs.
  if (!input.path.startsWith('/')) return { ok: false, reason: 'INVALID_PATH' };
  if (input.path.includes('://')) return { ok: false, reason: 'INVALID_PATH' };
  if (input.path.includes('\\')) return { ok: false, reason: 'INVALID_PATH' };

  const url = new URL(input.path, base);
  if (url.origin !== base.origin) return { ok: false, reason: 'ORIGIN_NOT_ALLOWED' };

  if (input.query) {
    for (const [k, v] of Object.entries(input.query)) {
      url.searchParams.set(k, v);
    }
  }

  return { ok: true, url };
}

