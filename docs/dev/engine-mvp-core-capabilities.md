## Engine MVP: core capabilities + workflow execution (inputs + acceptance)

This document captures the **MVP input assumptions**, **validation levels**, and **acceptance criteria** for the Engine MVP milestones implemented in this repo.

### Validation levels (explicit)

- **Contract (required)**: schemas + deterministic registry/discovery + deterministic unit/integration tests (no live GitHub required).
- **Runtime smoke (required)**: OpenBao `secretRefs` resolution against a real OpenBao + Dagger secret injection (no plaintext secret output).
- **Staging/production (out of scope for MVP)**: real GitHub webhooks, real GitHub API calls, real K8s cluster deploy.

### MVP inputs (defaults used by implementation)

- **GitHub (API)**
  - **Base URL (REST)**: `https://api.github.com`
  - **Base URL (GraphQL)**: `https://api.github.com/graphql`
  - **Auth**: Personal Access Token (PAT) injected via `secretRefs`
  - **Minimum scopes** (recommended for MVP):
    - **Commit statuses / checks**: `repo:status` (or `repo` for private repos)
    - **Workflow dispatch** (optional): `workflow`
    - **Private repo access**: `repo`

- **GitHub (webhook trigger)**
  - **Webhook secret** is configured as an **OpenBao secretRef** (see `GITHUB_WEBHOOK_SECRET_REF` below) and validated against `X-Hub-Signature-256`.
  - **Idempotency**: `workflowId = release-${deliveryId}` (GitHub delivery id).
    - Retries (same `deliveryId`) return **200 OK** and the **existing** `workflowId/runId`.

- **GitHub Actions dispatch (optional)**
  - **Default for MVP**: no dispatch configured (the release blueprint can run without dispatching Actions).
  - If you enable dispatch, you’ll provide:
    - **workflow identifier** (workflow file name or numeric id)
    - **ref** (branch/tag)
    - optional **inputs** map (string→string)

- **OpenBao (Vault-compatible)**
  - **Address**: `BAO_ADDR` (default: `http://localhost:8200`)
  - **Token**: `BAO_TOKEN` (default: `root` for local dev only)
  - **KV v2 mount**: `BAO_KV_MOUNT` (default: `secret`)
  - **SecretRef grammar (v1)**:
    - A `secretRef` is a string absolute path beginning with `/` (example: `/artifacts/console/public/secrets/github.token`)
    - Refs containing `..` segments are rejected.
  - **KV v2 read semantics**:
    - `GET /v1/{mount}/data/{normalizedPath}`
    - Value extraction prefers `data.data.value`; if absent, allow exactly one string field.

### OpenBao paths (ISS-001 conventions)

For MVP, use public secrets under the Console app id:

- GitHub API token: `/artifacts/console/public/secrets/github.token`
- GitHub webhook signing secret: `/artifacts/console/public/secrets/github.webhook_secret`
- (Smoke) sample secret: `/artifacts/console/public/secrets/engine_mvp.smoke`

**Stored value shape** (recommended):

- KV v2: `{"data":{"value":"<secret>"}}`

### Required environment variables (local dev)

- **OpenBao**
  - `BAO_ADDR=http://localhost:8200`
  - `BAO_TOKEN=root`
  - `BAO_KV_MOUNT=secret`

- **Dagger execution**
  - `ENABLE_DAGGER_E2E=1` (required for real container execution via the worker runtime)

- **GitHub webhook receiver (Console server)**
  - `GITHUB_WEBHOOK_SECRET_REF=/artifacts/console/public/secrets/github.webhook_secret`
  - `GITHUB_TOKEN_SECRET_REF=/artifacts/console/public/secrets/github.token`
  - `GITHUB_RELEASE_BLUEPRINT_ID=blueprints.ci.github-release` (default used by receiver; override allowed)

### Acceptance criteria (MVP)

- **prework-inputs**
  - This document exists and states defaults + validation levels + acceptance criteria.

- **engine-openbao-smoke**
  - A single commandable harness exists that:
    - starts/assumes OpenBao locally
    - writes a known test secret into KV v2
    - executes a minimal capability via the real Dagger execution path
    - proves `secretRef → OpenBao KV v2 → Dagger Secret mount` without outputting the plaintext secret
  - Local command:
    - `docker compose up -d openbao`
    - `ENABLE_DAGGER_E2E=1 pnpm --filter @golden/blueprints exec tsx scripts/run-openbao-secretrefs-smoke.ts`
  - If you’re blocked (e.g., in CI or Docker isn’t available), you can bypass the Docker preflight:
    - `SKIP_DOCKER_PREFLIGHT=1 ENABLE_DAGGER_E2E=1 pnpm --filter @golden/blueprints exec tsx scripts/run-openbao-secretrefs-smoke.ts`

- **github-real-connectors**
  - `golden.github.rest.request` performs real HTTP inside a Dagger container:
    - token is read from a mounted secret (not a plaintext env var)
    - outbound hosts are enforced against `security.networkAccess.allowOutbound` (default deny)
    - deterministic integration tests run against a local mock server
  - `golden.github.graphql.query` does the same for GraphQL POST.

- **release-blueprint-github-trigger**
  - A release blueprint exists that composes the GitHub capabilities.
  - A Console webhook endpoint validates `X-Hub-Signature-256`, normalizes an event envelope, and starts the release blueprint with idempotent `workflowId`.
  - Route tests cover: signature validation, idempotent start, and 200-on-retry behavior.

- **bluegreen-hardening**
  - `blueprints.deploy.blue-green` has deterministic composition tests asserting:
    - capability IDs used
    - `kubeconfigSecretRef` flows through `secretRefs` to the K8s capabilities
    - compensation registration coverage for mutating steps

- **tool discovery hygiene**
  - After adding/adjusting capabilities and blueprints: `pnpm tools:regen-sync` produces no uncommitted drift.

