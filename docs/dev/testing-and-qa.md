# Testing and QA (Golden Path / Harmony)

How to test and QA the platform and UI: unit tests, integration tests, manual QA, and CI.

## Quick reference

| Goal | Command |
|------|---------|
| All unit tests (affected) | `pnpm nx affected -t test` |
| All unit tests (everything) | `pnpm test` or `pnpm nx run-many -t test` |
| Console server + API tests | `pnpm nx run console:test` or `pnpm --dir packages/apps/console test` |
| Console client / UI tests | `pnpm --dir packages/apps/console test:client` or `cd packages/apps/console && pnpm test:client` |
| Full audit (lint, test, certify; excludes console) | `pnpm nx run harmony:audit` |
| Blueprints E2E (Temporal) | `pnpm nx run blueprints:e2e` |
| Manual QA: platform + UI | See [Manual QA](#manual-qa) below |

---

## 1. Unit and integration tests

### Run all tests (monorepo)

From repo root:

```bash
pnpm test
# or
pnpm nx run-many -t test
```

Runs Vitest for every project that has a `test` target (core, capabilities, blueprints, mcp-server, schema-registry, console, etc.). Console uses its own Vitest config and runs **server** tests only by default.

### Run only affected tests

```bash
pnpm nx affected -t test
```

Runs tests only for projects affected by your changes.

### Console app: server (API, routes, services)

Console server tests use Vitest + Supertest. They live under `packages/apps/console/server/**/*.test.ts`.

```bash
pnpm nx run console:test
# or from console package:
cd packages/apps/console && pnpm test
```

- **Config:** `packages/apps/console/vitest.config.ts`
- **Includes:** `server/**/*.test.ts`
- **Coverage:** server code (see `vitest.config.ts` coverage thresholds)

Optional: run with UI for debugging:

```bash
cd packages/apps/console && pnpm exec vitest --config vitest.config.ts --ui
```

### Console app: client (UI / React)

Client tests use Vitest + jsdom + React Testing Library. They live under `packages/apps/console/client/**/*.test.{ts,tsx}` and `**/__tests__/**`.

```bash
pnpm --dir packages/apps/console test:client
# or from console directory:
cd packages/apps/console && pnpm test:client
```

- **Config:** `packages/apps/console/vitest.client.config.ts`
- **Includes:** `client/**/*.test.{ts,tsx}` (and `__tests__` under client)
- **Setup:** `client/src/test-setup.ts` (jest-dom matchers, cleanup)

To run client tests in watch mode or with UI:

```bash
cd packages/apps/console && pnpm exec vitest --config vitest.client.config.ts
cd packages/apps/console && pnpm exec vitest --config vitest.client.config.ts --ui
```

From repo root you can also use: `pnpm nx run console:test` for server tests only; there is no Nx target for client tests yet, so use `pnpm --dir packages/apps/console test:client` for UI tests.

### Debug a single project’s tests

```bash
pnpm nx:test:debug
# or for specific packages:
pnpm test:path:debug       # tools/path
pnpm test:capabilities:debug  # packages/capabilities
```

### Postgres-backed integration tests (console)

Some console tests require a real Postgres database (e.g. `routes.postgres.int.test.ts`, `postgres-action-execution-repository.test.ts`).

1. Set `DATABASE_URL` (and optionally `REPOSITORY_MODE=postgres`).
2. Apply schema: `pnpm --dir packages/apps/console db:push` or `db:migrate` (see [Console Postgres](console-postgres.md)).
3. Run tests: `pnpm nx run console:test`. Tests that need Postgres will run when `DATABASE_URL` is set; others are skipped when it’s missing.

---

## 2. Manual QA (platform + UI)

End-to-end manual check of services, worker, Console UI, and MCP demo.

### 1) Start infrastructure

```bash
pnpm nx run harmony:dev-up
```

Starts Docker Compose: Postgres, Temporal, Temporal UI.

### 2) Start Temporal worker

In a separate terminal:

```bash
pnpm nx run harmony:dev-worker
```

Wait until you see the worker registered (e.g. task queue `golden-tools`).

### 3) Start Console (UI)

In another terminal:

```bash
pnpm nx run console:serve
# or: pnpm dev:console
```

- **URL:** http://localhost:5000 (or the port shown).
- **QA:** Incidents, Runbooks, Operations Hub, Workbench, Dashboard, Service Catalog, Compliance, etc.

### 4) (Optional) MCP demo

In another terminal:

```bash
pnpm nx run harmony:dev-demo -- --x 7
```

Runs the MCP demo against Temporal (tool list, sample tool call). Useful to confirm MCP server and Temporal integration.

### 5) Optional: Postgres for Console

For full Console features (actions, executions, etc.) with Postgres:

- Set `DATABASE_URL` and `REPOSITORY_MODE=postgres`.
- Run migrations: `pnpm --dir packages/apps/console db:migrate`.
- Restart Console.

See [Console Postgres](console-postgres.md).

---

## 3. Blueprints E2E (Temporal workflows)

Blueprints package has E2E tests that run real Temporal workflows (optional Dagger-based run).

```bash
# E2E with local Temporal
pnpm nx run blueprints:e2e

# E2E with Dagger (if configured)
pnpm nx run blueprints:e2e-dagger
```

Requires Temporal server and worker (e.g. `harmony:dev-up` + `harmony:dev-worker`).

---

## 4. Lint and type-check

```bash
pnpm lint
# or
pnpm nx run-many -t lint
```

Console also has a strict check (TypeScript + design-system checks):

```bash
pnpm nx run console:lint
# runs: pnpm run check (tsc + check-design-system)
```

---

## 5. Full audit (CI-style)

The `audit` target runs path sync check, affected lint + test (excluding console), and certification:

```bash
pnpm nx run harmony:audit
```

- **Note:** Console is excluded from this audit (`--exclude=console`). Run Console tests separately (server + client) as above.

Dagger-based audit (determinism, affected lint/test via Dagger):

```bash
pnpm nx run harmony:audit-dagger
```

---

## 6. CI (GitHub Actions)

CI currently runs:

1. **Determinism / Dagger audit** – `audit-git` (lint, test, determinism).
2. **Cursor skills (vendored)** – `tools/scripts/cursor-skills.mjs verify --vendored-only` and `cursor-skills.test.mjs`.
3. **Tool catalog drift** – regenerate tool catalog and fail if `tool-catalog.json` changed.

Console tests are not in the main audit pipeline (excluded). Adding Console server (and optionally client) tests to CI would require updating the audit command or adding a dedicated Console test job.

---

## 7. Certification

Certification (CAS-001 style) is run as part of the audit:

```bash
pnpm nx run certification:certify
```

Run standalone if needed (from repo root).

---

## Summary: QA checklist

- **Unit tests:** `pnpm test` or `pnpm nx affected -t test`
- **Console server:** `pnpm nx run console:test`
- **Console UI:** `pnpm --dir packages/apps/console test:client`
- **Manual platform + UI:** `dev-up` → `dev-worker` → `console:serve` → exercise app at http://localhost:5000
- **Blueprints E2E:** `pnpm nx run blueprints:e2e` (with Temporal up)
- **Lint:** `pnpm lint`; Console: `pnpm nx run console:lint`
- **Full audit:** `pnpm nx run harmony:audit` (excludes console; run Console tests separately)
