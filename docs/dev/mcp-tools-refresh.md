## Workbench tool catalog: refresh vs restart

## MCP Readiness Hard Gate (before blueprint tests)

Blueprint-first API tests must not run until both MCP paths are healthy:

1. Console catalog path:
   - `GET /api/mcp/tools` returns non-empty `tools`
   - `POST /api/mcp/tools/refresh` succeeds and bumps `manifest.generated_at`
2. Direct MCP path (outside Console proxy):
   - JSON-RPC handshake succeeds (`initialize`, `tools/list`, `tools/call`)

Fast verification commands:

```bash
# Console MCP gate + blueprint-first API smoke
pnpm --dir packages/apps/console exec vitest run server/blueprint-first-api-smoke.test.ts

# Direct MCP stdio handshake smoke (external MCP path)
pnpm -w vitest run packages/tools/mcp-server/src/demo/stdio-jsonrpc-client.test.ts
```

If either path fails, stop blueprint generation/run tests and remediate MCP health first.

### What “tools” are
- The Workbench tool palette is backed by the Console server endpoint `GET /api/mcp/tools`.
- The response includes a `manifest.generated_at` timestamp and `manifest.version`.

### Preferred path (no restart): refresh tools
- Use the **Refresh** button in the Workbench component palette (or Capabilities catalog).
- Or call:
  - `POST /api/mcp/tools/refresh`

### Quick validation: freshness + latency
- **Freshness**: after refresh, `manifest.generated_at` should increase.
- **Latency**: refresh should typically complete quickly (local dev: sub-second to a couple seconds).

```bash
# Measure refresh latency + verify a 200 response
curl -sS -o /dev/null -w "status=%{http_code} total=%{time_total}s\n" \
  -X POST "http://localhost:5000/api/mcp/tools/refresh"
```

### When you should restart anyway
Refresh reloads the current process snapshot. You still need a restart when:
- You changed code that affects module loading (new exports, package wiring), and the running server hasn’t reloaded that code.
- You suspect an older process is still bound to port **5000** (stale manifest served).

### Canonical command: restart Console tool surface

```bash
pnpm dev:console:restart
```

### Related commands
- Start Console (if not already running):

```bash
pnpm dev:console
```

