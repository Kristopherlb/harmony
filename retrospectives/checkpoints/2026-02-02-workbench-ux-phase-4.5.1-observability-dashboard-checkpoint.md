# Checkpoint: Workbench UX Phase 4.5.1 (Observability Dashboard)

**Date:** 2026-02-02  
**Session:** Phase 4.5.1 - Workbench Usage Dashboards (Grafana)

---

## Progress

### Completed
- [x] Added Grafana dashboard JSON for Workbench UX (`deploy/observability/grafana/workbench-dashboard.json`)
- [x] Updated observability README to document the Workbench dashboard (`deploy/observability/README.md`)

### In Progress
- [ ] Define + emit Prometheus metrics that the Workbench dashboard queries (Phase 4.5.2 prerequisite)

### Remaining
- [ ] Instrument Workbench client to emit analytics taxonomy events (Phase 4.5.2)
- [ ] Define SLOs and map them to concrete metrics/alerts (Phase 4.5.3)
- [ ] Full Phase 4.5 retrospective (Phase 4.5.4)

---

## Key Learnings

1. **Grafana conventions:** Existing dashboards in this repo assume a Prometheus datasource and follow a GOS-001-ish metric naming shape, so the Workbench dashboard should follow the same structure for consistency.
2. **Console “metrics” vs Prometheus:** The Console server has JSON “metrics” endpoints under `/api/metrics/*`, but Grafana dashboards here expect Prometheus time series; Workbench usage needs a Prometheus exporter layer (or equivalent).

---

## Friction Points

| Issue | Impact | Potential Solution |
|-------|--------|-------------------|
| Workbench usage metrics not yet exported as Prometheus series | Dashboard queries would be “empty” until instrumentation/exporter is implemented | Add a small Workbench telemetry endpoint + Prometheus exporter in Console server (Phase 4.5.2) |

---

## Improvement Opportunities

- [ ] **Documentation:** Add a short note in `deploy/observability/README.md` about where Prometheus should scrape Workbench metrics (once implemented).
- [ ] **Test:** Add a server route test that proves the Workbench metrics endpoint emits expected series names after telemetry events.

---

## Plan Alignment (Mandatory)

- Plan drift observed: The plan lists `deploy/observability/grafana-workbench-dashboard.json`, but existing repo conventions store dashboards under `deploy/observability/grafana/`.
- Proposed plan update(s):

```text
Place Workbench Grafana dashboard at deploy/observability/grafana/workbench-dashboard.json to match existing observability asset structure.
```

- Any new required preflight steps:
  - Once metrics exporter exists, ensure Prometheus is configured to scrape the Console Workbench metrics endpoint.

---

## Improvements / Capabilities That Would Help Next

- [ ] **Workflow/Script:** A generator or helper that produces a baseline GOS-001 Grafana dashboard JSON from a metric prefix + label set (similar to incident lifecycle).

---

## Questions / Blockers

1. Where is Prometheus scraping configuration managed for the Console service in this repo (or is it external)?

---

## Context for Next Session

- Currently working on: Phase 4.5.2 metrics instrumentation and export path that matches the dashboard queries.
- Next step: Implement a Console server Prometheus exporter for Workbench telemetry, then wire client events to it.
- Key files:
  - `deploy/observability/grafana/workbench-dashboard.json`
  - `docs/workbench-analytics-events.md`
  - `packages/apps/console/server/routers/workbench-router.ts`

