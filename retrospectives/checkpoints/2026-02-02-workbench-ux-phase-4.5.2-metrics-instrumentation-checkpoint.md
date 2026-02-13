# Checkpoint: Workbench UX Phase 4.5.2 (Metrics Instrumentation)

**Date:** 2026-02-02  
**Session:** Phase 4.5.2 - Metrics Instrumentation (analytics taxonomy → Prometheus)

---

## Progress

### Completed
- [x] Added Workbench Prometheus metrics registry + record helpers (`packages/apps/console/server/observability/workbench-metrics.ts`)
- [x] Added Workbench telemetry ingest + metrics endpoints:
  - `POST /api/workbench/telemetry`
  - `GET /api/workbench/metrics`
  (`packages/apps/console/server/routers/workbench-router.ts`)
- [x] Added server test for telemetry + metrics (`packages/apps/console/server/routers/workbench-telemetry.test.ts`)
- [x] Added client telemetry emitter (`packages/apps/console/client/src/lib/workbench-telemetry.ts`) + tests
- [x] Wired client telemetry to key Workbench flows:
  - session start/end + draft lifecycle + approvals (`packages/apps/console/client/src/pages/workbench-page.tsx`)
  - chat message sent + “proposeWorkflow” success/failure (`packages/apps/console/client/src/features/workbench/agent-chat-panel.tsx`)
  - workflow run started/completed (`packages/apps/console/client/src/features/workbench/run-blueprint-dialog.tsx`)

### In Progress
- [ ] Define concrete SLOs mapped to these metrics (Phase 4.5.3)

### Remaining
- [ ] SLO doc + alert queries (Phase 4.5.3)
- [ ] Full Phase 4.5 retrospective (Phase 4.5.4)

---

## Key Learnings

1. **Prometheus bridge is required:** The Console app needed a small “telemetry → Prometheus” bridge to make Grafana dashboards actionable without adding a full analytics pipeline.
2. **Low-cardinality constraints:** Sticking to a small label set (event/environment/status/approved) keeps metrics usable and avoids cardinality blowups.

---

## Friction Points

| Issue | Impact | Potential Solution |
|-------|--------|-------------------|
| Existing test suite has unrelated failing suites in the current branch | Hard to use “run all tests” as a validation signal for this slice | Keep Phase 4.5 tests isolated + runnable (`vitest run server/routers/workbench-telemetry.test.ts`, `vitest -c vitest.client.config.ts …`) |

---

## Improvement Opportunities

- [ ] **Documentation:** Add a short “Prometheus scrape endpoint” note for the Console service (e.g. `/api/workbench/metrics`).
- [ ] **Script:** Add a small smoke script (or runbook) that posts a telemetry event and verifies the metrics text contains expected series.

---

## Plan Alignment (Mandatory)

- Plan drift observed: The plan mentions a client file path for telemetry; implementation required a server ingestion + Prometheus exporter endpoint to make Grafana viable.
- Proposed plan update(s):

```text
Phase 4.5.2 should explicitly include a Console server endpoint that converts client analytics events into Prometheus metrics (for Grafana + SLOs).
```

- Any new required preflight steps:
  - Ensure Prometheus scrapes the Console Workbench metrics endpoint in the target environment.

---

## Improvements / Capabilities That Would Help Next

- [ ] **Tooling:** A repo-standard Prometheus “module pattern” (registry + endpoint + test harness) to reduce copy/paste for future dashboards.

---

## Questions / Blockers

1. Where should Prometheus scrape configuration live for the Console service in this repo (K8s, docker-compose, or external infra)?

---

## Context for Next Session

- Currently working on: turning these raw metrics into explicit SLO definitions and alert queries.
- Next step: write `docs/workbench-slos.md` with metric mapping + example PromQL.
- Key files:
  - `docs/workbench-analytics-events.md`
  - `packages/apps/console/server/observability/workbench-metrics.ts`
  - `deploy/observability/grafana/workbench-dashboard.json`

