## Feature Golden Path (agent workflow)

Use this workflow when implementing a Workbench-facing feature (no E2E).

### Default execution sequence

- **Scoped tests first**
  - Run `pnpm -C packages/apps/console test:client:workbench` for Workbench client changes.
  - If server prompt/router changes: run the specific affected server test file(s) in `packages/apps/console/server/**`.

- **Implement change**
  - Keep changes small, deterministic, and observable.
  - Add/extend unit tests for parsing/mapping/pure helpers before wiring UI.

- **Telemetry loop (when metrics are involved)**
  - Run `pnpm telemetry:smoke:workbench -- --base-url <console>` to validate series appear.

- **Observability assets**
  - Update/add:
    - `deploy/observability/grafana/workbench-dashboard.json`
    - `deploy/observability/prometheus/workbench-alerts.yaml`
    - `docs/workbench-slos.md`
    - `runbooks/console-metrics-scrape.md`

- **Registry hygiene**
  - If new tools/templates/caps were added:
    - Run `pnpm tools:regen-sync`
  - If the Workbench tool list looks stale:
    - Run `pnpm dev:console:restart`

