---
name: feature-golden-path
description: Golden paths for Workbench features: scoped tests, telemetry smoke, observability assets, and registry hygiene.
---

# Feature Golden Path (Workbench-first)

Use this skill when implementing or validating Workbench-facing features (client + console server), especially when the work needs to be observable and easy to verify without E2E.

## When to Use

- Adding a Workbench UI feature (chat, canvas, library, monitoring)
- Adding or changing Workbench telemetry/metrics
- Adding dashboards/alerts/runbooks for Workbench
- Seeing “empty dashboard” / “no series” / “tool list is stale” issues

## Golden Path 1: Workbench-scoped unit tests (fast feedback)

Prefer scoped test commands over running the entire Console suite.

### Console client (Workbench-only)

- **Direct (pnpm)**:

```bash
pnpm -C packages/apps/console test:client:workbench
```

- **Nx target**:

```bash
pnpm nx run console:test-client-workbench
```

## Golden Path 2: Telemetry → metrics smoke (definition → series)

After adding/changing telemetry, verify it’s flowing end-to-end:

```bash
pnpm telemetry:smoke:workbench -- --base-url http://localhost:3000
```

If you’re scraping a deployed Console:

```bash
pnpm telemetry:smoke:workbench -- --base-url https://<console-host>
```

## Golden Path 3: Observability assets (series → dashboard → alert)

- **Metrics endpoint**: `GET /api/workbench/metrics`
- **Telemetry ingestion**: `POST /api/workbench/telemetry`
- **Dashboard**: `deploy/observability/grafana/workbench-dashboard.json`
- **Alerts**: `deploy/observability/prometheus/workbench-alerts.yaml`
- **SLO definitions**: `docs/workbench-slos.md`
- **Scrape runbook**: `runbooks/console-metrics-scrape.md`
- **Infra README**: `deploy/observability/README.md`

Key rule: dashboards and alerts are only actionable once Prometheus is scraping `/api/workbench/metrics`.

## Golden Path 4: Registry hygiene + tool catalog freshness

Common friction: tools appear “missing” in Workbench until the catalog is regenerated and/or the server is restarted.

- **Pre-commit gate**: `.husky/pre-commit` (registry hygiene checks)
- **Regen + sync**:

```bash
pnpm tools:regen-sync
```

- **Console dev restart (when tool list looks stale)**:

```bash
pnpm dev:console:restart
```

## Notes

- Keep workflows deterministic (WCS-001); avoid non-deterministic time/randomness in workflow bundles.
- Prefer fixed-prefix route registration before `/:id`-style routes in Express routers to avoid shadowing.

