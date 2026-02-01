# DevEx Enhancements (4 items) — Status Update (post-implementation)

> Source plan (not modified): `.cursor/plans/devex_enhancements_x4_1ccf555e.plan.md`
>  
> This file captures **work completed** + **tasks remaining**.

---

## 1) CI determinism gate (GitHub Actions + Dagger)

### Completed
- **Dagger module added** at `.dagger/` exposing:
  - `sync-check --repo <Directory>`: runs `pnpm nx g @golden/path:sync`, then fails on `git diff --exit-code`
  - `audit --repo <Directory>`: runs `sync-check` behavior + `pnpm nx affected -t lint test`
  - `sync-check-git --repo-url <string> --ref <string>`: same check via git clone (no host upload)
  - `audit-git --repo-url <string> --ref <string>`: same audit via git clone (no host upload)
- **GitHub Actions workflow added** at `.github/workflows/ci.yml`:
  - Calls Dagger `audit-git --repo-url … --ref …` on PRs and pushes to `main` (no host upload).

### Remaining / follow-ups
- Optional: keep `--repo Directory` variants for cases where you explicitly want to run against a local tree without network access.

### Files added/changed
- `.dagger/**`
- `.github/workflows/ci.yml`

---

## 2) Workspace `audit` target (Nx)

### Completed
- Added `harmony:audit` in `project.json`:
  - `pnpm nx g @golden/path:sync && git diff --exit-code && pnpm nx affected -t lint test`
- Added `harmony:audit-dagger` in `project.json`:
  - `dagger -m ./.dagger call audit-git --repo-url "$(git remote get-url origin)" --ref "$(git rev-parse HEAD)"`

### Remaining / follow-ups
- Optional: expand `audit` composition (typecheck/build) once baseline lint/test is stable repo-wide.

### Files changed
- `project.json`

---

## 3) Temporal-first demo ergonomics (flag-controlled fallback)

### Completed
- **Fail-fast + actionable errors** for runner failures in `packages/tools/mcp-server/src/mcp/tool-surface.ts`:
  - Structured errors: `TEMPORAL_UNAVAILABLE`, `WORKER_NOT_RUNNING`, `RUNNER_ERROR`
  - Includes `trace_id` and hint commands (`harmony:dev-up`, `harmony:dev-worker`)
- **Await-mode timeout** in `packages/tools/mcp-server/src/mcp/temporal-default-runners.ts`:
  - Added `capabilityAwaitTimeoutMs` (wired from `MCP_CAPABILITY_AWAIT_TIMEOUT_MS` in `stdio-server.ts`)
- **Tests added/updated** to cover new behavior.

### Remaining / follow-ups
- Optional: align error payload shape with any broader “Golden error envelope” conventions if you formalize them later.

### Files changed
- `packages/tools/mcp-server/src/mcp/tool-surface.ts`
- `packages/tools/mcp-server/src/mcp/temporal-default-runners.ts`
- `packages/tools/mcp-server/src/mcp/stdio-server.ts`
- `packages/tools/mcp-server/src/mcp/tool-surface.test.ts`
- `packages/tools/mcp-server/src/mcp/temporal-default-runners.test.ts`

---

## 4) Single-command dev bootstrap (Nx)

### Completed
- Added `harmony:dev-bootstrap` in `project.json`:
  - Runs `harmony:dev-up`
  - Prints the next two canonical commands (`harmony:dev-worker`, `harmony:dev-demo`)

### Remaining / follow-ups
- Optional: add lightweight port checks (7233/8233) and print a clearer “already running” vs “started” message.

### Files changed
- `project.json`

---

## Cross-cutting notes

### Completed
- Test stability: fixed an export-name mismatch in the OpenFeature capability so generated registries remain valid.
- Added Vitest workspace aliasing for `mcp-server` to test against workspace sources reliably.

### Remaining / follow-ups
- Consider pinning/upgrading Dagger engine/CLI consistently (you’re currently on `v0.18.17`; Dagger suggests `v0.19.10`).

