# Runbook: Console Prometheus metrics scrape (Workbench UX)

## Purpose

Make Workbench UX dashboards and SLOs actionable by ensuring Prometheus is scraping the Console’s Prometheus-format metrics endpoint(s), and by providing a quick validation loop for “is this live?” checks.

This runbook is designed to be executable manually and to be compatible with a future “telemetry smoke” script.

## Endpoints

### Workbench UX metrics (Prometheus format)

- **Endpoint:** `GET /api/workbench/metrics`
- **Owner:** Console server
- **Notes:** This endpoint exports Workbench telemetry (ingested via `POST /api/workbench/telemetry`) as Prometheus time series.

## Prerequisites

- Console is reachable from Prometheus (network + DNS + auth if applicable).
- If you run behind an ingress, ensure the path `/api/workbench/metrics` is exposed.

## Quick validation (no Prometheus required)

### 1) Curl the metrics endpoint

```bash
curl -sS https://<console-host>/api/workbench/metrics | head -n 40
```

You should see Prometheus text exposition and series names like:

- `golden_contract_workbench_events_total`
- `golden_contract_workbench_event_duration_seconds_bucket`
- `golden_contract_workbench_runs_total`

### 2) Generate at least one event (optional)

If you have a browser session in Workbench, it should emit events automatically.

If you need to force a single event, POST a minimal payload:

```bash
curl -sS -X POST https://<console-host>/api/workbench/telemetry \
  -H "content-type: application/json" \
  -d '{"event":"workbench.session_started","sessionId":"runbook-smoke","timestamp":"2026-02-02T00:00:00.000Z"}' \
  -i
```

Then re-check `/api/workbench/metrics` and confirm counters increment.

### 3) Telemetry → metrics smoke (recommended)

This repo includes a reusable smoke script that posts a synthetic telemetry event and then polls the metrics endpoint until expected series appear.

From repo root:

```bash
pnpm telemetry:smoke:workbench -- --base-url https://<console-host>
```

Notes:
- This posts to `POST /api/workbench/telemetry` and polls `GET /api/workbench/metrics`.
- If you run locally, you can omit `--base-url` (defaults to `http://localhost:3000`).

## Prometheus scrape configuration (external infra)

This repository does **not** contain a Prometheus scrape config (no `prometheus.yml`, no ServiceMonitor/Helm manifests). Scrape wiring is expected to be applied in your Prometheus deployment (external infra repo or managed Prometheus).

### Example: `scrape_configs` job

```yaml
scrape_configs:
  - job_name: console-workbench
    metrics_path: /api/workbench/metrics
    scheme: https
    static_configs:
      - targets:
          - console.example.com
```

If your Console requires auth, prefer a Prometheus-side auth mechanism appropriate for your deployment (e.g., mTLS, OAuth2 proxy, or a private network path).

## Grafana + SLO linkage

- **Dashboard:** `deploy/observability/grafana/workbench-dashboard.json`
- **SLOs:** `docs/workbench-slos.md`

If the dashboard is empty:

1. Confirm `/api/workbench/metrics` returns series
2. Confirm Prometheus is scraping (targets are `UP`)
3. Confirm the dashboard datasource and labels (e.g. `$environment`) match emitted series

