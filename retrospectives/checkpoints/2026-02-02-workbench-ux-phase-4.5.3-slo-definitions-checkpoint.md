# Checkpoint: Workbench UX Phase 4.5.3 (SLO Definitions)

**Date:** 2026-02-02  
**Session:** Phase 4.5.3 - SLO Definitions (response time + success rate)

---

## Progress

### Completed
- [x] Authored initial Workbench SLO definitions and PromQL mapping (`docs/workbench-slos.md`)
- [x] Added client-side duration capture for `workbench.draft_edited` (supports canvas edit latency SLO)

### In Progress
- [ ] Consolidate Phase 4.5 into a full retrospective (Phase 4.5.4)

### Remaining
- [ ] Full Phase 4.5 retrospective + proposed plan updates (Phase 4.5.4)

---

## Key Learnings

1. **SLOs must map to real series:** A usable SLO doc needs explicit metric names + PromQL queries that match emitted telemetry, otherwise it becomes aspirational rather than operational.
2. **UX SLOs are “client-observed”:** These SLOs are closer to “user experience” than “worker correctness”; they complement (not replace) workflow/Temporal SLOs.

---

## Friction Points

| Issue | Impact | Potential Solution |
|-------|--------|-------------------|
| Some UX targets (e.g. “canvas updates”) are tricky to measure precisely without deeper render instrumentation | Risk of mismatched measurement vs perceived UX | Start with handler-duration approximation; if needed, add `requestAnimationFrame`-based end-to-end measurement behind sampling |

---

## Improvement Opportunities

- [ ] **Documentation:** Add example alert rules file for Workbench (similar to `deploy/observability/prometheus/incident-alerts.yaml`) once thresholds are validated.
- [ ] **Test:** Add a targeted unit test ensuring `durationMs` is emitted for `workbench.draft_edited` in the primary edit path (if we refactor Workbench state handling).

---

## Plan Alignment (Mandatory)

- Plan drift observed: SLO definitions depend on a telemetry → Prometheus bridge (Phase 4.5.2) and therefore should be sequenced explicitly.
- Proposed plan update(s):

```text
Phase 4.5.3 should reference concrete Prometheus series names and example PromQL so the SLO doc is immediately actionable.
```

- Any new required preflight steps:
  - Confirm Prometheus is scraping the Console Workbench metrics endpoint before treating SLOs as “live”.

---

## Improvements / Capabilities That Would Help Next

- [ ] **Workflow/Script:** Add a “Workbench SLO smoke” workflow that generates synthetic telemetry and validates PromQL queries produce expected results (in a test Prometheus).

---

## Questions / Blockers

1. Do we want a dedicated Prometheus rule file for Workbench alerts under `deploy/observability/prometheus/` (mirroring incident lifecycle)?

---

## Context for Next Session

- Currently working on: preparing the full Phase 4.5 retrospective.
- Next step: summarize outcomes + plan alignment + improvements into `retrospectives/sessions/...phase-4.5...`.
- Key files:
  - `docs/workbench-slos.md`
  - `deploy/observability/grafana/workbench-dashboard.json`
  - `packages/apps/console/server/observability/workbench-metrics.ts`

