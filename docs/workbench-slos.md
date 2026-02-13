# Workbench SLOs (Phase 4.5.3)

This document defines initial Workbench UX SLOs and how to measure them using the Phase 4.5 telemetry → Prometheus bridge.

## 1. Scope

**Measured system:** Console Workbench UX (client) as observed via server-emitted Prometheus metrics:
- `GET /api/workbench/metrics`

**Primary dashboard:** `deploy/observability/grafana/workbench-dashboard.json`

## 2. Response Time SLOs

### 2.1 Chat response time (proposal generation)

- **Goal:** \(p95 < 2s\) for “propose workflow” chat turns.
- **Metric:** `golden_contract_workbench_event_duration_seconds_bucket{event="workbench.chat_tool_invoked"}`
- **PromQL (p95):**

```promql
histogram_quantile(
  0.95,
  sum(rate(golden_contract_workbench_event_duration_seconds_bucket{
    event="workbench.chat_tool_invoked",
    environment="$environment"
  }[5m])) by (le)
)
```

### 2.2 Canvas edit apply time (node property edits)

- **Goal:** \(p95 < 0.5s\) for client-side draft edits initiated from canvas UI.
- **Metric (planned):** `golden_contract_workbench_event_duration_seconds_bucket{event="workbench.draft_edited"}`
- **PromQL (p95):**

```promql
histogram_quantile(
  0.95,
  sum(rate(golden_contract_workbench_event_duration_seconds_bucket{
    event="workbench.draft_edited",
    environment="$environment"
  }[5m])) by (le)
)
```

> TODO: If “draft_edited” durations become too noisy or frequent, sample emissions or split by editType (with a strict allowlist).

## 3. Success Rate SLOs

### 3.1 Draft acceptance rate

- **Goal:** \(> 95%\) of proposals are accepted (vs rejected), rolling 1h.
- **Signals:**
  - `workbench.draft_accepted` (good)
  - `workbench.draft_rejected` (bad)
- **PromQL:**

```promql
sum(increase(golden_contract_workbench_events_total{
  event="workbench.draft_accepted",
  environment="$environment"
}[1h]))
/
clamp_min(
  sum(increase(golden_contract_workbench_events_total{
    event=~"workbench.draft_accepted|workbench.draft_rejected",
    environment="$environment"
  }[1h])),
  1
)
```

### 3.2 Workflow run success rate (Workbench-triggered)

- **Goal:** \(> 90%\) completed vs \((completed + failed + cancelled)\), rolling 6h.
- **Signals:** `golden_contract_workbench_runs_total{status=...}`
- **PromQL:**

```promql
sum(increase(golden_contract_workbench_runs_total{status="completed", environment="$environment"}[6h]))
/
clamp_min(
  sum(increase(golden_contract_workbench_runs_total{status=~"completed|failed|cancelled", environment="$environment"}[6h])),
  1
)
```

## 4. Suggested Alerts (initial)

These are intentionally simple “guardrail” alerts; tune thresholds once baseline data exists.

### 4.1 Chat latency SLO breach (warning)

```promql
histogram_quantile(
  0.95,
  sum(rate(golden_contract_workbench_event_duration_seconds_bucket{
    event="workbench.chat_tool_invoked",
    environment="$environment"
  }[10m])) by (le)
) > 2
```

### 4.2 Draft acceptance rate drop (warning)

```promql
(
  sum(increase(golden_contract_workbench_events_total{event="workbench.draft_accepted", environment="$environment"}[1h]))
  /
  clamp_min(sum(increase(golden_contract_workbench_events_total{event=~"workbench.draft_accepted|workbench.draft_rejected", environment="$environment"}[1h])), 1)
) < 0.95
```

### 4.3 Workflow run success rate drop (warning)

```promql
(
  sum(increase(golden_contract_workbench_runs_total{status="completed", environment="$environment"}[6h]))
  /
  clamp_min(sum(increase(golden_contract_workbench_runs_total{status=~"completed|failed|cancelled", environment="$environment"}[6h])), 1)
) < 0.90
```

## 5. Notes

- These SLOs are “client observed” (derived from client-emitted telemetry) and should be interpreted as UX-level signals, not worker/Temporal execution SLOs.

