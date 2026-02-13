/**
 * packages/capabilities/src/connectors/jira-runtime.ts
 *
 * Purpose: Shared Jira HTTP runtime used by Jira connector capabilities.
 * This is embedded into a Dagger container via `withNewFile(...)`.
 */
export const JIRA_HTTP_RUNTIME_CJS = String.raw`'use strict';

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

async function main() {
  const raw = process.env.INPUT_JSON;
  if (!raw) throw Object.assign(new Error('Missing INPUT_JSON'), { status: 500 });
  const input = JSON.parse(raw);

  const secretsDir = String(process.env.SECRETS_DIR || '/run/secrets').replace(/\/+$/, '');

  const method = String(input.method ?? 'GET').toUpperCase();
  const host = input.host;
  const path = input.path;
  const authMode = input.authMode;
  const url = appendQuery(joinUrl(host, path), input.query);

  const headers = { Accept: 'application/json' };

  if (authMode === 'basic') {
    const email = readSecret(secretsDir + '/jira_email');
    const token = readSecret(secretsDir + '/jira_api_token');
    if (!email || !token) throw Object.assign(new Error('Missing Jira Basic Auth secrets'), { status: 401 });
    const b64 = Buffer.from(email + ':' + token, 'utf8').toString('base64');
    headers.Authorization = 'Basic ' + b64;
  } else if (authMode === 'oauth2') {
    const accessToken = readSecret(secretsDir + '/jira_access_token');
    if (!accessToken) throw Object.assign(new Error('Missing Jira OAuth2 access token'), { status: 401 });
    headers.Authorization = 'Bearer ' + accessToken;
  } else {
    throw Object.assign(new Error('Invalid authMode'), { status: 400 });
  }

  /** @type {RequestInit} */
  const init = { method, headers };

  if (method !== 'GET' && method !== 'HEAD') {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(input.body ?? {});
  }

  const res = await fetch(url, init);
  const text = await res.text();
  if (!res.ok) {
    const err = new Error('HTTP ' + res.status + ': ' + (text || res.statusText));
    err.status = res.status;
    throw err;
  }

  const json = text ? JSON.parse(text) : {};
  process.stdout.write(JSON.stringify(json));
}

main().catch((err) => {
  const status = typeof err?.status === 'number' ? err.status : undefined;
  // Do not log secrets; only surface status + message.
  console.error(String(err?.message ?? err));
  if (typeof status === 'number' && status > 0 && status <= 255) {
    process.exit(status);
  }
  process.exit(1);
});
`;

