/**
 * packages/tools/workbench-server/src/server.ts
 * Hardened Workbench HTTP server (session + proxy APIs).
 *
 * This is a security-sensitive surface. Even though the “transport” inputs are generic,
 * the server MUST enforce RBAC, allowlists, query firewall rules, and abuse limits.
 */
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize } from 'node:path';
import {
  createWorkbenchSessionRequestSchema,
  workbenchGraphqlProxyRequestSchema,
  workbenchRestProxyRequestSchema,
} from '@golden/core';
import { analyzeGraphqlDocument } from './security/graphql-firewall.js';
import { buildAllowlistedUrl } from './security/ssrf.js';
import { createKeycloakAuthenticator, type Principal } from './auth/keycloak.js';
import { authenticateDev, readDevAuthConfigFromEnv } from './auth/dev.js';
import { parseCookieHeader, parseSessionCookie, serializeSessionCookie } from './auth/session-cookie.js';
import { createOpenBaoClient, resolveProviderTokenFromOpenBao } from './secrets/openbao.js';

export interface WorkbenchServerOptions {
  port: number;
  /**
   * Test-only injection hooks. These MUST NOT be used in production.
   * They exist so we can TDD security invariants without needing Keycloak/OpenBao live.
   */
  testHooks?: {
    authenticate?: (req: http.IncomingMessage) => Promise<Principal>;
    providerGraphql?: (input: { provider: string; token: string; query: string; variables?: unknown; operationName?: string }) => Promise<{
      data?: unknown;
      errors?: unknown;
      extensions?: unknown;
    }>;
    providerRest?: (input: {
      provider: string;
      token: string;
      method: string;
      url: string;
      body?: unknown;
    }) => Promise<{ status: number; headers: Record<string, string>; body: unknown }>;
    tokenForProvider?: (input: { provider: string; initiatorId: string }) => Promise<string>;
  };
}

export interface WorkbenchServer {
  listen(): Promise<void>;
  close(): Promise<void>;
  address(): string;
}

type SessionRecord = {
  sessionId: string;
  initiatorId: string;
  provider: string;
  kind: string;
  mode: string;
  expiresAtMs: number;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DIST_UI_DIR = join(__dirname, '..', 'dist-ui');
const SPEC_DIR = join(__dirname, '..', '..', '..', '..', 'spec');

type ProviderConfig = {
  id: string;
  restBaseUrl?: string;
  openapiSpecFile?: string;
  graphqlSchemaFile?: string;
};

const PROVIDERS: Record<string, ProviderConfig> = {
  github: {
    id: 'github',
    restBaseUrl: 'https://api.github.com',
    openapiSpecFile: 'github.openapi.json',
    graphqlSchemaFile: 'github.schema.introspection.json',
  },
  jira: {
    id: 'jira',
    // Jira Cloud REST via Atlassian API gateway. Tenant is encoded in path (cloudId).
    restBaseUrl: 'https://api.atlassian.com',
    openapiSpecFile: 'jira.openapi.json',
  },
  // GitLab is supported by the contract, but may not have a spec artifact in-repo yet.
  // When present, it should be added under spec/ and wired here without changing the UI.
  gitlab: {
    id: 'gitlab',
    restBaseUrl: 'https://gitlab.com',
    openapiSpecFile: 'gitlab.openapi.json',
  },
};

function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return c;
    }
  });
}

function isZodError(err: unknown): boolean {
  return err !== null && typeof err === 'object' && 'name' in err && (err as { name?: unknown }).name === 'ZodError';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readDevProviderToken(input: { provider: string; env: Record<string, string | undefined> }): string | null {
  const key = `WORKBENCH_DEV_PROVIDER_TOKEN_${input.provider.toUpperCase()}`;
  const v = (input.env[key] ?? '').trim();
  return v.length > 0 ? v : null;
}

function json(res: http.ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(body));
}

function contentTypeForPath(pathname: string): string {
  const lower = pathname.toLowerCase();
  if (lower.endsWith('.html')) return 'text/html; charset=utf-8';
  if (lower.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (lower.endsWith('.css')) return 'text/css; charset=utf-8';
  if (lower.endsWith('.json')) return 'application/json; charset=utf-8';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.ttf')) return 'font/ttf';
  if (lower.endsWith('.woff')) return 'font/woff';
  if (lower.endsWith('.woff2')) return 'font/woff2';
  return 'application/octet-stream';
}

async function serveUiFile(res: http.ServerResponse, relPath: string): Promise<void> {
  // Prevent path traversal.
  const normalized = normalize(relPath).replace(/^(\.\.(\/|\\|$))+/, '');
  const abs = join(DIST_UI_DIR, normalized);
  try {
    const data = await readFile(abs);
    res.statusCode = 200;
    res.setHeader('content-type', contentTypeForPath(relPath));
    res.end(data);
  } catch {
    // Fallback for dev/test when the UI bundle hasn't been built yet.
    // This is intentionally minimal and still CSP-compatible.
    const label =
      relPath.includes('graphiql') ? 'Workbench GraphiQL' : relPath.includes('swagger') ? 'Workbench Swagger UI' : 'Workbench UI';
    res.statusCode = 200;
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(label)}</title>
  </head>
  <body>
    <h1>${escapeHtml(label)}</h1>
    <p>UI bundle not built. Run <code>pnpm nx run workbench-server:build-ui</code>.</p>
  </body>
</html>`);
  }
}

async function serveJsonFile(res: http.ServerResponse, absPath: string): Promise<void> {
  const raw = await readFile(absPath, 'utf8');
  res.statusCode = 200;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(raw);
}

async function readJsonBody(req: http.IncomingMessage, maxBytes: number): Promise<unknown> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > maxBytes) {
      throw new Error('BODY_TOO_LARGE');
    }
    chunks.push(buf);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  return JSON.parse(raw);
}

function hasRole(roles: string[], role: string): boolean {
  return roles.includes(role);
}

function readSessionTtlMs(input: { environment: string }): number {
  // Defaults:
  // - local: 60 minutes (dev-friendly)
  // - otherwise: 10 minutes (tight by default)
  const raw = (process.env.WORKBENCH_SESSION_TTL_MS ?? '').trim();
  const parsed = raw ? Number(raw) : Number.NaN;
  const defaultTtl = input.environment === 'local' ? 60 * 60 * 1000 : 10 * 60 * 1000;
  const ttl = Number.isFinite(parsed) ? parsed : defaultTtl;

  // Guardrails:
  // - keep within 1 minute .. 24 hours by default
  // - allow longer in local dev (up to 365 days) so sessions can be "effectively forever"
  const max = input.environment === 'local' ? 365 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  return Math.max(60_000, Math.min(max, ttl));
}

export function createWorkbenchServer(options: WorkbenchServerOptions): WorkbenchServer {
  const sessions = new Map<string, SessionRecord>();
  const perUserWindow = new Map<string, { windowStartMs: number; count: number }>();
  const perUserInFlight = new Map<string, number>();

  const env = process.env.WORKBENCH_ENVIRONMENT ?? process.env.MCP_ENVIRONMENT ?? 'local';
  const appId = process.env.WORKBENCH_APP_ID ?? process.env.MCP_APP_ID ?? 'golden-workbench';
  const issuer = process.env.WORKBENCH_OIDC_ISSUER ?? '';
  const audience = process.env.WORKBENCH_OIDC_AUDIENCE ?? '';
  const corsOriginsDefault =
    env === 'local'
      ? [
          'http://localhost:5000',
          'http://127.0.0.1:5000',
          'http://localhost:3000',
          'http://127.0.0.1:3000',
          'http://localhost:5173',
          'http://127.0.0.1:5173',
        ].join(',')
      : 'http://localhost:3000';
  const corsOrigins = (process.env.WORKBENCH_CORS_ORIGINS ?? corsOriginsDefault)
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const maxPerMinute = Number(process.env.WORKBENCH_RATE_LIMIT_PER_MINUTE ?? '120');
  const maxInFlight = Number(process.env.WORKBENCH_CONCURRENCY_PER_USER ?? '8');

  const publicBaseUrlRaw = process.env.WORKBENCH_PUBLIC_BASE_URL ?? '';
  let publicBaseUrl: URL | undefined;
  if (publicBaseUrlRaw) {
    try {
      const u = new URL(publicBaseUrlRaw);
      if (u.protocol === 'http:' || u.protocol === 'https:') publicBaseUrl = u;
    } catch {
      // Ignore invalid configuration; launchUrl will simply be omitted.
    }
  }

  const openbaoAddr = process.env.BAO_ADDR ?? process.env.WORKBENCH_OPENBAO_ADDR ?? '';
  const openbaoToken = process.env.BAO_TOKEN ?? process.env.BAO_DEV_ROOT_TOKEN_ID ?? process.env.WORKBENCH_OPENBAO_TOKEN ?? '';
  const openbao = openbaoAddr && openbaoToken ? createOpenBaoClient({ address: openbaoAddr, token: openbaoToken }) : undefined;

  const authenticateDefault =
    issuer && audience ? createKeycloakAuthenticator({ issuer, audience, environment: env }) : undefined;

  const devAuth = readDevAuthConfigFromEnv(process.env);
  const sessionCookieSecret = (process.env.WORKBENCH_SESSION_HMAC_SECRET ?? '').trim();
  const sessionCookieCfg =
    sessionCookieSecret.length > 0 ? { name: 'workbench_session', hmacSecret: sessionCookieSecret } : undefined;

  function originAllowed(req: http.IncomingMessage): boolean {
    const origin = req.headers.origin;
    if (typeof origin !== 'string' || origin.length === 0) return false;
    if (corsOrigins.includes(origin)) return true;

    // Local dev convenience: if dev auth is enabled for local, allow common localhost origins
    // even when WORKBENCH_CORS_ORIGINS is configured narrowly. This keeps the UX seamless
    // while remaining scoped to explicit dev mode.
    if (devAuth.enabled && devAuth.environment === 'local') {
      const localAllowed = new Set([
        'http://localhost:5000',
        'http://127.0.0.1:5000',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:5173',
        'http://127.0.0.1:5173',
      ]);
      if (localAllowed.has(origin)) return true;
    }

    // Allow same-origin requests (launch UI loads from this server and then POSTs back).
    // This is safe for browsers: Origin is set by the user agent and cannot be spoofed by scripts.
    const host = typeof req.headers.host === 'string' ? req.headers.host : '';
    if (!host) return false;
    if (origin === `http://${host}`) return true;
    if (origin === `https://${host}`) return true;
    return false;
  }

  function enforceRateLimit(initiatorId: string): boolean {
    const now = Date.now();
    const entry = perUserWindow.get(initiatorId) ?? { windowStartMs: now, count: 0 };
    if (now - entry.windowStartMs >= 60_000) {
      entry.windowStartMs = now;
      entry.count = 0;
    }
    entry.count += 1;
    perUserWindow.set(initiatorId, entry);
    return entry.count <= maxPerMinute;
  }

  async function withConcurrency<T>(initiatorId: string, fn: () => Promise<T>): Promise<T> {
    const cur = perUserInFlight.get(initiatorId) ?? 0;
    if (cur >= maxInFlight) throw new Error('TOO_MANY_IN_FLIGHT');
    perUserInFlight.set(initiatorId, cur + 1);
    try {
      return await fn();
    } finally {
      const after = (perUserInFlight.get(initiatorId) ?? 1) - 1;
      perUserInFlight.set(initiatorId, Math.max(0, after));
    }
  }

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const method = (req.method ?? 'GET').toUpperCase();

      // Minimal hardening headers (expanded later for CSP, etc.)
      res.setHeader('x-content-type-options', 'nosniff');
      res.setHeader('referrer-policy', 'no-referrer');
      res.setHeader('cache-control', 'no-store');

      // CORS (minimal)
      const origin = typeof req.headers.origin === 'string' ? req.headers.origin : undefined;
      if (origin && corsOrigins.includes(origin)) {
        res.setHeader('access-control-allow-origin', origin);
        res.setHeader('vary', 'origin');
        res.setHeader('access-control-allow-credentials', 'true');
        res.setHeader('access-control-allow-headers', 'authorization,content-type,x-csrf-token');
        res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
      }
      if (method === 'OPTIONS') {
        res.statusCode = 204;
        return res.end();
      }

      if (method === 'GET' && url.pathname === '/workbench/health') {
        return json(res, 200, { ok: true });
      }

      const authenticate = options.testHooks?.authenticate;
      const authHeader = typeof req.headers.authorization === 'string' ? req.headers.authorization : undefined;
      const cookies = parseCookieHeader(typeof req.headers.cookie === 'string' ? req.headers.cookie : undefined);
      const cookiePrincipal = sessionCookieCfg
        ? parseSessionCookie({ cfg: sessionCookieCfg, value: cookies[sessionCookieCfg.name] })
        : undefined;

      const principal =
        (authenticate ? await authenticate(req) : undefined) ??
        cookiePrincipal ??
        (await authenticateDefault?.(authHeader)) ??
        authenticateDev(req, devAuth);
      if (!principal) return json(res, 401, { error: 'UNAUTHENTICATED' });
      if (!enforceRateLimit(principal.initiatorId)) return json(res, 429, { error: 'RATE_LIMITED' });

      // Keycloak bearer -> signed session cookie (for browser launch UI without custom headers)
      if (method === 'POST' && url.pathname === '/workbench/auth/session') {
        if (!originAllowed(req)) return json(res, 403, { error: 'FORBIDDEN', reason: 'ORIGIN_NOT_ALLOWED' });
        if (!sessionCookieCfg) return json(res, 500, { error: 'SESSION_COOKIE_NOT_CONFIGURED' });
        // Require OIDC auth for minting cookie (dev mode should not mint cookies).
        const p = await authenticateDefault?.(authHeader);
        if (!p) return json(res, 401, { error: 'UNAUTHENTICATED' });
        const cookieValue = serializeSessionCookie({ cfg: sessionCookieCfg, principal: p, ttlSeconds: 60 * 60 });
        const secure = publicBaseUrl?.protocol === 'https:' ? ' Secure;' : '';
        res.setHeader(
          'set-cookie',
          `${sessionCookieCfg.name}=${cookieValue}; Path=/; HttpOnly; SameSite=Lax;${secure}`
        );
        return json(res, 200, { ok: true });
      }

      if (method === 'POST' && url.pathname === '/workbench/sessions') {
        if (!originAllowed(req)) return json(res, 403, { error: 'FORBIDDEN', reason: 'ORIGIN_NOT_ALLOWED' });
        const raw = await readJsonBody(req, 256 * 1024);
        const input = createWorkbenchSessionRequestSchema.parse(raw);

        const providerRole = `provider:${input.provider}`;
        if (!hasRole(principal.roles, providerRole)) {
          return json(res, 403, { error: 'FORBIDDEN', reason: 'MISSING_PROVIDER_ROLE' });
        }
        if (input.mode === 'launch' && !hasRole(principal.roles, 'workbench:launch')) {
          return json(res, 403, { error: 'FORBIDDEN', reason: 'MISSING_LAUNCH_ROLE' });
        }

        const sessionId = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
        const ttlMs = readSessionTtlMs({ environment: principal.environment });
        const expiresAtMs = Date.now() + ttlMs;
        sessions.set(sessionId, {
          sessionId,
          initiatorId: principal.initiatorId,
          provider: input.provider,
          kind: input.kind,
          mode: input.mode,
          expiresAtMs,
        });

        const launchUrl =
          input.mode === 'launch' && publicBaseUrl
            ? (() => {
                const u = new URL(`/workbench/launch/${encodeURIComponent(input.kind)}`, publicBaseUrl);
                u.searchParams.set('sessionId', sessionId);
                u.searchParams.set('provider', input.provider);
                return u.toString();
              })()
            : undefined;

        return json(res, 200, {
          sessionId,
          expiresAt: new Date(expiresAtMs).toISOString(),
          ...(launchUrl ? { launchUrl } : {}),
        });
      }

      if (method === 'POST' && url.pathname === '/workbench/proxy/graphql') {
        if (!originAllowed(req)) return json(res, 403, { error: 'FORBIDDEN', reason: 'ORIGIN_NOT_ALLOWED' });
        const input = workbenchGraphqlProxyRequestSchema.parse(await readJsonBody(req, 512 * 1024));

        const s = sessions.get(input.sessionId);
        if (!s) return json(res, 404, { error: 'SESSION_NOT_FOUND' });
        if (s.expiresAtMs <= Date.now()) return json(res, 401, { error: 'SESSION_EXPIRED' });
        if (s.initiatorId !== principal.initiatorId) return json(res, 403, { error: 'FORBIDDEN' });

        const firewall = analyzeGraphqlDocument({
          query: input.query,
          operationName: input.operationName,
          introspectionAllowed: principal.environment === 'local',
          limits:
            principal.environment === 'local'
              ? {
                  // Dev ergonomics: GraphiQL plugins / introspection can be large.
                  // Keep some ceiling, but allow substantially more than prod.
                  maxDocumentChars: 200_000,
                  maxDepth: 20,
                  maxAliases: 5000,
                  maxSelections: 20_000,
                  maxFragments: 1000,
                }
              : {
                  maxDocumentChars: 200_000,
                  maxDepth: 12,
                  maxAliases: 50,
                  maxSelections: 2000,
                  maxFragments: 100,
                },
        });
        if (!firewall.ok) {
          if (firewall.reason === 'INTROSPECTION_DISABLED') {
            return json(res, 400, { error: 'QUERY_REJECTED', reason: 'INTROSPECTION_DISABLED' });
          }
          return json(res, 400, { error: 'QUERY_REJECTED', reason: firewall.reason });
        }
        if (firewall.operationType === 'subscription') {
          return json(res, 400, { error: 'QUERY_REJECTED', reason: 'SUBSCRIPTIONS_NOT_SUPPORTED' });
        }
        if (firewall.operationType === 'query' && !hasRole(principal.roles, 'workbench:graphql:query')) {
          return json(res, 403, { error: 'FORBIDDEN', reason: 'MISSING_GRAPHQL_QUERY_ROLE' });
        }
        if (firewall.operationType === 'mutation' && !hasRole(principal.roles, 'workbench:graphql:mutation')) {
          return json(res, 403, { error: 'FORBIDDEN', reason: 'MISSING_GRAPHQL_MUTATION_ROLE' });
        }

        return await withConcurrency(principal.initiatorId, async () => {
          const tokenForProvider = options.testHooks?.tokenForProvider;
          const providerGraphql = options.testHooks?.providerGraphql;
          if (providerGraphql) {
            const token =
              (tokenForProvider ? await tokenForProvider({ provider: s.provider, initiatorId: principal.initiatorId }) : null) ??
              (devAuth.enabled && principal.environment === 'local'
                ? readDevProviderToken({ provider: s.provider, env: process.env })
                : null);
            if (!token) {
              if (!openbao) {
                return json(res, 500, {
                  error: 'OPENBAO_NOT_CONFIGURED',
                  hint: `For local dev, set WORKBENCH_DEV_PROVIDER_TOKEN_${s.provider.toUpperCase()} or configure OpenBao.`,
                });
              }
            } else {
              const out = await providerGraphql({
                provider: s.provider,
                token,
                query: input.query,
                variables: input.variables,
                operationName: input.operationName,
              });
              return json(res, 200, out);
            }
          }
          if (!openbao) {
            return json(res, 500, {
              error: 'OPENBAO_NOT_CONFIGURED',
              hint: `For local dev, set WORKBENCH_DEV_PROVIDER_TOKEN_${s.provider.toUpperCase()} or configure OpenBao.`,
            });
          }
          // Default provider client (GitHub only for now)
          if (s.provider !== 'github') return json(res, 400, { error: 'PROVIDER_NOT_ALLOWED' });
          const ctx = { app_id: appId, environment: env, initiator_id: principal.initiatorId, trace_id: randomUUID() };
          const token = await resolveProviderTokenFromOpenBao({
            openbao,
            ctx,
            provider: s.provider,
            scope: 'user',
          });
          const controller = new AbortController();
          const t = setTimeout(() => controller.abort(), 15_000);
          try {
            const gh = await fetch('https://api.github.com/graphql', {
              method: 'POST',
              headers: {
                authorization: `Bearer ${token}`,
                'content-type': 'application/json',
                accept: 'application/json',
              },
              body: JSON.stringify({
                query: input.query,
                variables: input.variables,
                operationName: input.operationName,
              }),
              signal: controller.signal,
            });
            const text = await gh.text();
            let parsed: unknown = {};
            try {
              parsed = JSON.parse(text);
            } catch {
              parsed = {};
            }
            const body = isRecord(parsed) ? parsed : {};
            return json(res, 200, { data: body.data, errors: body.errors, extensions: body.extensions });
          } finally {
            clearTimeout(t);
          }
        });
      }

      if (method === 'POST' && url.pathname === '/workbench/proxy/rest') {
        if (!originAllowed(req)) return json(res, 403, { error: 'FORBIDDEN', reason: 'ORIGIN_NOT_ALLOWED' });
        const input = workbenchRestProxyRequestSchema.parse(await readJsonBody(req, 512 * 1024));

        const s = sessions.get(input.sessionId);
        if (!s) return json(res, 404, { error: 'SESSION_NOT_FOUND' });
        if (s.expiresAtMs <= Date.now()) return json(res, 401, { error: 'SESSION_EXPIRED' });
        if (s.initiatorId !== principal.initiatorId) return json(res, 403, { error: 'FORBIDDEN' });

        const isRead = input.method === 'GET' || input.method === 'HEAD';
        if (isRead && !hasRole(principal.roles, 'workbench:rest:read')) {
          return json(res, 403, { error: 'FORBIDDEN', reason: 'MISSING_REST_READ_ROLE' });
        }
        if (!isRead && !hasRole(principal.roles, 'workbench:rest:write')) {
          return json(res, 403, { error: 'FORBIDDEN', reason: 'MISSING_REST_WRITE_ROLE' });
        }

        // Provider base URLs are fixed (allowlist).
        const providerCfg = PROVIDERS[s.provider];
        const baseUrl = providerCfg?.restBaseUrl ?? '';
        if (!baseUrl) return json(res, 400, { error: 'PROVIDER_NOT_ALLOWED' });

        const built = buildAllowlistedUrl({ baseUrl, path: input.path, query: input.query });
        if (!built.ok) return json(res, 400, { error: 'REQUEST_REJECTED', reason: built.reason });

        return await withConcurrency(principal.initiatorId, async () => {
          const tokenForProvider = options.testHooks?.tokenForProvider;
          const providerRest = options.testHooks?.providerRest;
          if (providerRest) {
            const token =
              (tokenForProvider ? await tokenForProvider({ provider: s.provider, initiatorId: principal.initiatorId }) : null) ??
              (devAuth.enabled && principal.environment === 'local'
                ? readDevProviderToken({ provider: s.provider, env: process.env })
                : null);
            if (!token) {
              if (!openbao) {
                return json(res, 500, {
                  error: 'OPENBAO_NOT_CONFIGURED',
                  hint: `For local dev, set WORKBENCH_DEV_PROVIDER_TOKEN_${s.provider.toUpperCase()} or configure OpenBao.`,
                });
              }
            } else {
              const out = await providerRest({
                provider: s.provider,
                token,
                method: input.method,
                url: built.url.toString(),
                body: input.body,
              });
              const filtered: Record<string, string> = {};
              for (const [k, v] of Object.entries(out.headers ?? {})) {
                const key = k.toLowerCase();
                if (key === 'set-cookie' || key === 'www-authenticate' || key === 'authorization') continue;
                filtered[k] = v;
              }
              return json(res, 200, { status: out.status, headers: filtered, body: out.body });
            }
          }
          if (!openbao) {
            return json(res, 500, {
              error: 'OPENBAO_NOT_CONFIGURED',
              hint: `For local dev, set WORKBENCH_DEV_PROVIDER_TOKEN_${s.provider.toUpperCase()} or configure OpenBao.`,
            });
          }
          const ctx = { app_id: appId, environment: env, initiator_id: principal.initiatorId, trace_id: randomUUID() };
          const token = await resolveProviderTokenFromOpenBao({
            openbao,
            ctx,
            provider: s.provider,
            scope: 'user',
          });

          const controller = new AbortController();
          const t = setTimeout(() => controller.abort(), 15_000);
          try {
            const out = await fetch(built.url, {
              method: input.method,
              headers: {
                authorization: `Bearer ${token}`,
                accept: 'application/json',
                'user-agent': 'golden-workbench',
                ...(input.body ? { 'content-type': 'application/json' } : {}),
              },
              body: input.body ? JSON.stringify(input.body) : undefined,
              redirect: 'manual',
              signal: controller.signal,
            });
            if (out.status >= 300 && out.status < 400) {
              return json(res, 400, { error: 'REQUEST_REJECTED', reason: 'REDIRECT_BLOCKED' });
            }
            const text = await out.text();
            const body = (() => {
              try {
                return JSON.parse(text);
              } catch {
                return text;
              }
            })();
            const headers: Record<string, string> = {};
            for (const [k, v] of out.headers.entries()) {
              const key = k.toLowerCase();
              if (key === 'set-cookie' || key === 'www-authenticate' || key === 'authorization') continue;
              headers[k] = v;
            }
            return json(res, 200, { status: out.status, headers, body });
          } finally {
            clearTimeout(t);
          }
        });
      }

      if (method === 'GET' && url.pathname.startsWith('/workbench/launch/')) {
        // Launch pages are auth-gated. Sessions are handled invisibly by the UI:
        // - if sessionId is missing/expired, the UI auto-creates a new session.
        // This prevents "session expired" UX from leaking to users.
        const kindFromPath = url.pathname.slice('/workbench/launch/'.length);
        if (kindFromPath !== 'graphql' && kindFromPath !== 'openapi') {
          res.statusCode = 404;
          res.setHeader('content-type', 'text/plain; charset=utf-8');
          return res.end('Not found');
        }

        res.setHeader(
          'content-security-policy',
          "default-src 'self'; base-uri 'none'; object-src 'none'; img-src 'self' data:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-eval'; connect-src 'self'; frame-ancestors 'self'"
        );
        res.setHeader('x-frame-options', 'SAMEORIGIN');

        if (kindFromPath === 'graphql') {
          await serveUiFile(res, 'graphiql/index.html');
          return;
        }
        if (kindFromPath === 'openapi') {
          await serveUiFile(res, 'swagger/index.html');
          return;
        }
        res.statusCode = 404;
        res.setHeader('content-type', 'text/plain; charset=utf-8');
        return res.end('Not found');
      }

      // Schema docs for GraphiQL (served from local repo artifacts, not live provider introspection).
      if (method === 'GET' && url.pathname.startsWith('/workbench/schema/')) {
        const provider = url.pathname.slice('/workbench/schema/'.length);
        const sessionId = url.searchParams.get('sessionId') ?? '';
        const s = sessions.get(sessionId);
        if (!s) return json(res, 404, { error: 'SESSION_NOT_FOUND' });
        if (s.expiresAtMs <= Date.now()) return json(res, 401, { error: 'SESSION_EXPIRED' });
        if (s.initiatorId !== principal.initiatorId) return json(res, 403, { error: 'FORBIDDEN' });
        if (s.kind !== 'graphql') return json(res, 400, { error: 'INVALID_SESSION_KIND' });
        if (provider !== s.provider) return json(res, 400, { error: 'PROVIDER_MISMATCH' });
        if (provider !== 'github') return json(res, 400, { error: 'PROVIDER_NOT_ALLOWED' });

        await serveJsonFile(res, join(SPEC_DIR, PROVIDERS.github.graphqlSchemaFile!));
        return;
      }

      // OpenAPI docs for Swagger UI (served from local repo artifacts).
      if (method === 'GET' && url.pathname.startsWith('/workbench/openapi/')) {
        const provider = url.pathname.slice('/workbench/openapi/'.length);
        const sessionId = url.searchParams.get('sessionId') ?? '';
        const s = sessions.get(sessionId);
        if (!s) return json(res, 404, { error: 'SESSION_NOT_FOUND' });
        if (s.expiresAtMs <= Date.now()) return json(res, 401, { error: 'SESSION_EXPIRED' });
        if (s.initiatorId !== principal.initiatorId) return json(res, 403, { error: 'FORBIDDEN' });
        if (s.kind !== 'openapi') return json(res, 400, { error: 'INVALID_SESSION_KIND' });
        if (provider !== s.provider) return json(res, 400, { error: 'PROVIDER_MISMATCH' });

        const cfg = PROVIDERS[provider];
        if (!cfg?.openapiSpecFile) return json(res, 400, { error: 'PROVIDER_NOT_ALLOWED' });

        try {
          await serveJsonFile(res, join(SPEC_DIR, cfg.openapiSpecFile));
        } catch {
          return json(res, 404, { error: 'SPEC_NOT_FOUND' });
        }
        return;
      }

      // Static launch UI assets (no CDN). Served from Vite build output.
      // Note: these assets are not secrets. Auth/session binding is handled at the launch page and proxy endpoints.
      if (method === 'GET' && url.pathname.startsWith('/assets/')) {
        const rel = url.pathname.replace(/^\//, '');
        await serveUiFile(res, rel);
        return;
      }

      return json(res, 404, { error: 'NOT_FOUND' });
    } catch (e) {
      if (e instanceof SyntaxError) {
        return json(res, 400, { error: 'INVALID_JSON' });
      }
      if (isZodError(e)) {
        return json(res, 400, { error: 'INPUT_VALIDATION_FAILED' });
      }
      if (e instanceof Error && e.message === 'BODY_TOO_LARGE') {
        return json(res, 413, { error: 'BODY_TOO_LARGE' });
      }
      if (e instanceof Error && e.message === 'TOO_MANY_IN_FLIGHT') {
        return json(res, 429, { error: 'TOO_MANY_IN_FLIGHT' });
      }
      return json(res, 500, { error: 'INTERNAL_ERROR' });
    }
  });

  return {
    listen: () =>
      new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(options.port, () => resolve());
      }),
    close: () =>
      new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
    address: () => {
      const addr = server.address();
      if (!addr) return '';
      if (typeof addr === 'string') return addr;
      return `http://127.0.0.1:${addr.port}`;
    },
  };
}
