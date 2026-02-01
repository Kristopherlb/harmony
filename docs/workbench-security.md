## Workbench Security (OWASP Top 10:2025 aligned)

This document describes the security posture for the **Workbench Session server** (embedded + launch) that supports interactive QA of provider APIs (Swagger/OpenAPI + GraphQL).

### Scope
- **In scope**: `packages/tools/workbench-server/` HTTP endpoints:
  - `POST /workbench/sessions`
  - `POST /workbench/proxy/graphql`
  - `POST /workbench/proxy/rest`
  - `GET /workbench/launch/:kind?sessionId=...`
- **Non-goals**: provider-side authorization models (GitHub/GitLab), provider-side GraphQL cost analysis, and production-grade UI bundling for GraphiQL/Swagger (the app can embed richer UI while still using the same proxy).

### Core invariants
- **No-token-to-browser**: provider tokens are never returned to the client, never logged, and never stored in URLs.
- **SSRF-safe proxying**: REST proxy accepts only relative paths; outbound origins are fixed allowlist per provider; redirects are blocked.
- **RBAC gates everything**: launch mode, provider selection, REST read/write, and GraphQL query/mutation are all role-gated.
- **Abuse limits**: rate limits, concurrency caps, request/response size limits, and timeouts are enforced server-side.
- **GraphQL query firewall**: AST-based limits plus introspection gating (dev-only).
- **No Host-header trust**: launch URLs are emitted only when `WORKBENCH_PUBLIC_BASE_URL` is configured (prevents host-header injection).

### RBAC matrix (minimum)
Role naming is intentionally simple strings; you can map Keycloak roles to these values.

- **Provider access**
  - `provider:github`
  - `provider:gitlab`
- **Launch mode**
  - `workbench:launch`
- **REST**
  - Read-only methods (GET/HEAD): `workbench:rest:read`
  - Mutating methods (POST/PUT/PATCH/DELETE): `workbench:rest:write`
- **GraphQL**
  - Queries: `workbench:graphql:query`
  - Mutations: `workbench:graphql:mutation`
  - Subscriptions: **not supported** (always denied)

### OpenBao secret handling (ISS-001 compatible)
Tokens are retrieved server-side via OpenBao and injected only into outbound requests.

- **Secret name convention**: `{provider}.token` (example: `github.token`)
- **Secret path convention**: derived via `buildOpenBaoPath(ctx, secretName, scope)`
  - user scope: `/artifacts/{app_id}/users/{initiator_id}/secrets/{secretName}`
  - public scope: `/artifacts/{app_id}/public/secrets/{secretName}`
- **Expected secret payload shapes** (server supports multiple):
  - KV v1: `{ data: { value: "..." } }` or `{ data: { token: "..." } }`
  - KV v2: `{ data: { data: { value: "..." } } }`

### GraphQL “query firewall” limits
Workbench uses AST heuristics to reduce abuse amplification:
- **Max document chars**: 200,000
- **Max depth**: 12 selection-set depth
- **Max aliases**: 50
- **Max selections**: 2000
- **Max fragments**: 100
- **Introspection**:
  - Allowed only when `WORKBENCH_ENVIRONMENT=local`
  - Denied otherwise (`__schema` / `__type` blocked)

### Transport-level abuse limits
- **Rate limit**: `WORKBENCH_RATE_LIMIT_PER_MINUTE` (default 120) per user
- **Concurrency cap**: `WORKBENCH_CONCURRENCY_PER_USER` (default 8) in-flight per user
- **Timeouts**: outbound provider requests default to 15s total (AbortController)
- **Body size limits**:
  - session create: 256 KiB
  - proxy endpoints: 512 KiB
- **Redirects**: blocked for REST proxy (manual redirects + reject 3xx)

### CORS / CSRF stance
- The server expects **Bearer auth** (OIDC JWT), not cookies, but still enforces an **Origin allowlist** for state-changing endpoints.
- **Allowed origins** are configured by `WORKBENCH_CORS_ORIGINS` (CSV).
- `POST` endpoints require `Origin` to be present and allowlisted.

### OWASP Top 10:2025 mapping (selected)
- **A01 Broken Access Control**: per-session user binding; per-role gates on provider, launch, method, operation type.
- **A02 Security Misconfiguration**: deny-by-default outbound; strict origin allowlist; secure headers for launch pages.
- **A04 Cryptographic Failures**: JWT validation against issuer + audience; strong random session IDs; no plaintext token exposure.
- **A05 Injection**: no user-controlled URLs; no user-controlled headers; GraphQL parsed as AST, not executed locally.
- **A07 Authentication Failures**: OIDC issuer/audience validation; reject missing/invalid Bearer tokens.
- **A09 Logging/Alerting Failures**: do not log payloads by default; log only metadata (implementation guidance).
- **A10 Exceptional Conditions**: bounded timeouts; concurrency caps; rate limiting.

### Operational checklist
- Set `WORKBENCH_OIDC_ISSUER` and `WORKBENCH_OIDC_AUDIENCE` for your Keycloak realm/client.
- Set `WORKBENCH_APP_ID` to match your application identity.
- Set `WORKBENCH_CORS_ORIGINS` to your app’s origins (local + deployed).
- Set `WORKBENCH_PUBLIC_BASE_URL` (https) if you want `launchUrl` returned from `POST /workbench/sessions`.
- Configure OpenBao address/token:
  - `BAO_ADDR` and `BAO_TOKEN` (or `BAO_DEV_ROOT_TOKEN_ID` for local dev)
- Ensure provider tokens exist at the expected OpenBao paths (user scope).
- Review RBAC assignments (especially `workbench:rest:write` and `workbench:graphql:mutation`).
- Keep `WORKBENCH_ENVIRONMENT` set to `local` only for dev; treat non-local as production posture (introspection disabled).

### Browser usage (dev exploration vs Keycloak auth)

#### Dev exploration (no Keycloak required)
Enable dev auth (local only):
- `WORKBENCH_DEV_AUTH=true`
- Optional: `WORKBENCH_DEV_USER=user:you`
- Optional: `WORKBENCH_DEV_ROLES=provider:github,workbench:launch,workbench:graphql:query,workbench:rest:read`

Notes:
- `POST` endpoints require an allowlisted `Origin` header (configure `WORKBENCH_CORS_ORIGINS`).
- This mode is for exploration only; do not enable in production.

#### Keycloak auth for launch UI (cookie session)
Launch pages are authenticated. For browser-based exploration, the easiest flow is:
1) Obtain an **OIDC Bearer token** for your Keycloak client.
2) Exchange it for a **signed HttpOnly cookie**:
   - `POST /workbench/auth/session` with `Authorization: Bearer <token>` and an allowlisted `Origin`.
3) Create sessions and open launch URLs; the browser will send the cookie automatically.

Required configuration:
- `WORKBENCH_OIDC_ISSUER`
- `WORKBENCH_OIDC_AUDIENCE`
- `WORKBENCH_SESSION_HMAC_SECRET`
