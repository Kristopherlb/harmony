## Purpose

Validate “runtime-true” Release baseline locally:

GitHub webhook → Console ingress → Temporal workflow → GitHub API (via Dagger-backed capabilities).

This runbook is intentionally opinionated and reproducible on a developer laptop.

## Prerequisites

- Docker (daemon running)
- Node.js + pnpm installed
- A GitHub token with permission to read the target repo
  - Provide it via `GITHUB_TOKEN` **env var** for the harness (it will be written to local OpenBao; never printed)

## What this validates

- Console webhook ingress:
  - signature verification (`X-Hub-Signature-256`)
  - idempotent Temporal start (`release-${deliveryId}`)
- Blueprint execution:
  - `blueprints.ci.github-release`
- Capability runtime:
  - `golden.github.rest.request` executes in Dagger (real container)
  - `golden.github.graphql.query` executes in Dagger (real container)
- SecretRefs:
  - `GITHUB_WEBHOOK_SECRET_REF` and `GITHUB_TOKEN_SECRET_REF` are read from OpenBao KV v2

## Run (recommended: separate terminals)

Terminal 1 (dependencies):

```bash
pnpm nx run harmony:dev-up
```

Terminal 2 (runtime-true worker; requires Dagger):

```bash
pnpm nx run harmony:dev-worker-dagger
```

Terminal 3 (Console UI + API):

```bash
pnpm nx run console:serve
```

Terminal 4 (E2E harness):

```bash
GITHUB_TOKEN=... node tools/scripts/release-local-e2e.mjs --repo owner/repo
```

Expected output:
- JSON with `ok: true` and `workflowId`
- A `result` payload matching the blueprint output (no secrets)

## Run (one-command mode)

This mode spawns the worker + console processes for you (best effort), but you still need deps up.

```bash
pnpm nx run harmony:dev-up
GITHUB_TOKEN=... node tools/scripts/release-local-e2e.mjs --repo owner/repo --spawn
```

## Troubleshooting

- **Console is not reachable**:
  - Ensure `pnpm nx run console:serve` is running and listening on `http://localhost:5000`.
- **Temporal health fails (`/api/workflows/health`)**:
  - Ensure dependencies are up: `pnpm nx run harmony:dev-up`.
- **Dagger errors / `DAGGER_E2E_DISABLED`**:
  - Ensure you started the correct worker: `pnpm nx run harmony:dev-worker-dagger`.
  - Ensure Docker daemon is running.
- **OpenBao read/write fails**:
  - Ensure OpenBao is running (included in `harmony:dev-up`).
  - Ensure `BAO_TOKEN` is `root` for local dev.

