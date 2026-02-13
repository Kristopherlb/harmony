/**
 * packages/capabilities/src/connectors/github-runtime.ts
 *
 * Purpose: Shared GitHub HTTP runtime embedded in Dagger containers.
 *
 * - Reads token from mounted secret path only.
 * - Enforces allowOutbound with default-deny.
 * - Writes JSON to stdout for worker parsing.
 */
export const GITHUB_HTTP_RUNTIME_CJS = String.raw`'use strict';

const fs = require('node:fs');

function readSecret(path) {
  if (!path) return undefined;
  const v = fs.readFileSync(path, 'utf8');
  return String(v ?? '').trim();
}

function joinUrl(host, path) {
  const h = String(host ?? '').replace(/\/+$/, '');
  const p = String(path ?? '').startsWith('/') ? String(path ?? '') : '/' + String(path ?? '');
  return h + p;
}

function appendQuery(url, query) {
  if (!query || typeof query !== 'object') return url;
  const u = new URL(url);
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) {
      for (const item of v) {
        if (item === undefined || item === null) continue;
        u.searchParams.append(k, String(item));
      }
      continue;
    }
    u.searchParams.set(k, String(v));
  }
  return u.toString();
}

function hostAllowed(host, allowOutbound) {
  const patterns = Array.isArray(allowOutbound) ? allowOutbound : [];
  if (patterns.includes('*')) return true;
  const h = String(host ?? '').toLowerCase();
  for (const p of patterns) {
    const pat = String(p ?? '').toLowerCase();
    if (!pat) continue;
    if (pat === h) return true;
    if (pat.startsWith('*.')) {
      const suffix = pat.slice(1); // ".example.com"
      if (h.endsWith(suffix) && h.length > suffix.length) return true;
    }
  }
  return false;
}

function safeHeaders(headers) {
  try {
    if (headers && typeof headers.entries === 'function') {
      const out = {};
      for (const [k, v] of headers.entries()) out[String(k)] = String(v);
      return out;
    }
  } catch {}
  return {};
}

async function main() {
  const raw = process.env.INPUT_JSON;
  if (!raw) throw Object.assign(new Error('Missing INPUT_JSON'), { status: 500 });
  const input = JSON.parse(raw);

  const secretsDir = String(process.env.SECRETS_DIR || '/run/secrets').replace(/\/+$/, '');

  const mode = String(input.mode ?? '');
  const baseUrl = input.baseUrl;
  const allowOutbound = input.allowOutbound;
  if (!baseUrl) throw Object.assign(new Error('Missing baseUrl'), { status: 500 });

  const token = readSecret(secretsDir + '/github_token');
  if (!token) throw Object.assign(new Error('Missing GitHub token secret'), { status: 401 });

  let url = '';
  /** @type {RequestInit} */
  const init = { method: 'GET', headers: { Accept: 'application/json' } };
  init.headers['User-Agent'] = 'harmony-mvp';
  init.headers.Authorization = 'Bearer ' + token;

  if (mode === 'rest') {
    const method = String(input.method ?? 'GET').toUpperCase();
    const path = input.path;
    url = appendQuery(joinUrl(baseUrl, path), input.query);
    init.method = method;
    if (method !== 'GET' && method !== 'HEAD') {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(input.body ?? {});
    }
  } else if (mode === 'graphql') {
    url = joinUrl(baseUrl, '/graphql');
    init.method = 'POST';
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify({ query: input.query, variables: input.variables ?? {} });
  } else {
    throw Object.assign(new Error('Invalid mode'), { status: 400 });
  }

  const host = new URL(url).host;
  if (!hostAllowed(host, allowOutbound)) {
    throw Object.assign(new Error('OUTBOUND_HOST_NOT_ALLOWED'), { status: 403 });
  }

  const res = await fetch(url, init);
  const text = await res.text();
  if (!res.ok) {
    const err = new Error('HTTP ' + res.status + ': ' + (res.statusText || ''));
    err.status = res.status;
    throw err;
  }

  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { text };
  }

  process.stdout.write(
    JSON.stringify({
      status: res.status,
      headers: safeHeaders(res.headers),
      body,
    })
  );
}

main().catch((err) => {
  const status = typeof err?.status === 'number' ? err.status : undefined;
  console.error(String(err?.message ?? err));
  if (typeof status === 'number' && status > 0 && status <= 255) {
    process.exit(status);
    return;
  }
  process.exit(1);
});
`;

