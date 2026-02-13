# Workbench Operator Command Cheat-Sheet

Purpose: one place for the highest-signal commands operators use during local Workbench validation.

---

## 0) MCP in Cursor (Harmony Context) — Turn On / Auto-Availability

When you work in this repo with Cursor, the **Harmony MCP server** should be available to the AI so it can use capabilities and blueprints. Easiest setup:

1. **Open the Harmony repo as the workspace root** (so Cursor runs MCP from repo root).
2. **Use the project MCP config** — `.cursor/mcp.json` is already set to run `tools/scripts/run-harmony-mcp.mjs`. That script builds the MCP server if needed, then starts it over stdio. No separate “turn on” step: the first time you (or the AI) use an MCP tool, Cursor runs the script, which builds then starts the server.
3. **Optional: run tools (Temporal)** — Listing tools and discovery work without Temporal. To *run* capabilities or blueprints from MCP, start Temporal and the worker: `pnpm nx run harmony:dev-up` and `pnpm nx run harmony:dev-worker`. If you only need tool listing (e.g. for chat/codegen), you can skip this.

**Manual run (same as Cursor uses):**

```bash
pnpm mcp:stdio
```

Or build once then run stdio directly: `pnpm nx run dev-mcp` (build + stdio). The project `.cursor/mcp.json` is set to `pnpm run mcp:stdio` so Cursor runs from repo root and the wrapper builds then starts the server.

---

## 0b) Is MCP Up? (One Command — Console/HTTP)

From repo root, verify the Harmony MCP server and Console catalog are available before blueprint or discovery work:

```bash
pnpm mcp:ready
```

This runs the MCP hard gate (Console `/api/mcp/tools` + refresh + direct JSON-RPC handshake + propose/run smoke). If it passes, MCP is up and available.

**Capability (for pipelines or Dagger):** Use `golden.observability.mcp-readiness` with input `{ baseUrl: "http://localhost:5000" }` to check the Console MCP endpoint from a container (e.g. CI or health checks).

---

## 1) Start Local Stack

From repo root:

```bash
pnpm install
pnpm nx serve console
```

Optional runtime services (for run monitoring and workflow execution):

```bash
pnpm nx run harmony:dev-up
pnpm nx run harmony:dev-worker
```

Open:

- `http://localhost:5000/workbench`

---

## 2) MCP Hard Gate (Run Before Blueprint Tests)

**Preferred:** use the single entry point:

```bash
pnpm mcp:ready
```

Or run the underlying checks explicitly:

Console MCP catalog + refresh + blueprint-first API smoke:

```bash
pnpm --dir packages/apps/console exec vitest run server/blueprint-first-api-smoke.test.ts
```

Direct MCP handshake smoke (initialize/tools/list/tools/call):

```bash
pnpm -w vitest run packages/tools/mcp-server/src/demo/stdio-jsonrpc-client.test.ts
```

If any check fails, stop blueprint generation tests and fix MCP readiness first.

---

## 3) Discovery Contract Fast Loop

Intent + discovery + eval regression suite:

```bash
pnpm --dir packages/apps/console exec vitest run \
  server/services/intent-router.test.ts \
  server/services/openai-agent-service.test.ts \
  server/services/openai-agent-service.evals.test.ts
```

Expected behavior:

- discovery responses are catalog-grounded
- discovery does not auto-generate workflow drafts

---

## 4) Tool Catalog Freshness / Stale Tool Fix

Regenerate and sync deterministic tool catalog artifacts:

```bash
pnpm tools:regen-sync
```

Restart console if tool list appears stale:

```bash
pnpm dev:console:restart
```

---

## 5) Blueprint-First Propose/Run Validation

Primary smoke command:

```bash
pnpm --dir packages/apps/console exec vitest run server/blueprint-first-api-smoke.test.ts
```

This validates:

- MCP gate
- `/api/agent/blueprint/propose`
- `/api/workflows/run-blueprint`
- workflow status/result checks

---

## 6) Telemetry / Metrics Smoke

```bash
pnpm telemetry:smoke:workbench -- --base-url http://localhost:3000
```

Manual endpoints:

- `POST /api/workbench/telemetry`
- `GET /api/workbench/metrics`

---

## 7) Common Troubleshooting

Workbench tools missing:

```bash
pnpm tools:regen-sync
pnpm dev:console:restart
```

Run appears stuck:

```bash
pnpm nx run harmony:dev-up
pnpm nx run harmony:dev-worker
```

Need focused Workbench client tests:

```bash
pnpm nx run console:test-client-workbench
```

---

## 8) Reference Docs

- `docs/workbench/workbench-agent-golden-path.md`
- `docs/workbench/workbench-golden-path-manual-qa.md`
- `docs/workbench/VALIDATION-MATRIX.md`
- `docs/dev/mcp-tools-refresh.md`
