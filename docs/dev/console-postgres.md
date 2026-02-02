# Console Postgres Mode (Golden Path)

This doc describes the **recommended** way to run the Console with Postgres-backed storage for events and workflow executions.

## Prerequisites

- **Environment**
  - `DATABASE_URL` is set (Postgres connection string)
  - `REPOSITORY_MODE=postgres`

## Apply schema

The Console uses Drizzle for schema definitions at:

- `packages/apps/console/shared/db-schema.ts`

### Recommended (migrations)

From repo root:

```bash
pnpm --dir packages/apps/console db:generate
pnpm --dir packages/apps/console db:migrate
```

### Fast dev iteration (push-only)

From repo root:

```bash
pnpm --dir packages/apps/console db:push
```

> `db:push` is convenient for local iteration, but migrations are the more durable workflow for team/dev/CI parity.

## Run Console

From repo root:

```bash
REPOSITORY_MODE=postgres DATABASE_URL="postgres://..." pnpm dev:console
```

## Smoke checks

- Unit/integration (in-memory + contract tests):

```bash
pnpm -w nx test console
```

- Postgres integration tests (only run when `DATABASE_URL` is set):
  - `packages/apps/console/server/routes.postgres.int.test.ts`
  - `packages/apps/console/server/repositories/postgres-*.test.ts`

## Notes

- Workflow executions are persisted to the `workflow_executions` table.
- Events are stored in `events` (including `incident_id` for canonical incident linking).

