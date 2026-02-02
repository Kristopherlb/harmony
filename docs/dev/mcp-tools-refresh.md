## Workbench tool catalog: refresh vs restart

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

