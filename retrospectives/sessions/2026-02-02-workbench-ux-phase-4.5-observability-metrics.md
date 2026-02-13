# Retrospective: Workbench UX Phase 4.5 (Observability & SLOs)

**Date:** 2026-02-02  
**Session Duration:** ~90 minutes  
**Artifacts Produced:**
- `deploy/observability/grafana/workbench-dashboard.json`
- `packages/apps/console/server/observability/workbench-metrics.ts`
- `packages/apps/console/server/routers/workbench-router.ts` (telemetry + metrics endpoints)
- `packages/apps/console/client/src/lib/workbench-telemetry.ts` (+ tests)
- `docs/workbench-slos.md`
- Checkpoints:
  - `retrospectives/checkpoints/2026-02-02-workbench-ux-phase-4.5.1-observability-dashboard-checkpoint.md`
  - `retrospectives/checkpoints/2026-02-02-workbench-ux-phase-4.5.2-metrics-instrumentation-checkpoint.md`
  - `retrospectives/checkpoints/2026-02-02-workbench-ux-phase-4.5.3-slo-definitions-checkpoint.md`

---

## What Went Well

### 1. Reused existing observability conventions
Leaning on the existing incident lifecycle dashboard structure (Prometheus-first, low-cardinality metrics) kept Phase 4.5 aligned with repo standards and made the outcome immediately usable.

### 2. Telemetry → Prometheus bridge stayed intentionally small
A small server-side bridge (ingest events + export Prometheus) avoided introducing a heavyweight analytics system while still enabling Grafana dashboards and SLO queries.

### 3. Targeted tests for new behavior
Adding isolated tests for the Workbench router telemetry path enabled “local correctness” verification even when unrelated suites were unstable.

---

## What Could Have Been Better

### 1. Prometheus scrape configuration location is unclear
**Impact:** Hard to declare SLOs “live” without knowing where/if Prometheus scrapes Console metrics in each environment.

### 2. No durable draft/run IDs in Workbench telemetry yet
**Impact:** Limits the ability to do per-draft funnels (created → accepted → run) without adding stable identifiers.

---

## The Golden Path (If It Existed)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Step 1: Define analytics taxonomy + metric prefix                   │
│  Outputs: docs/workbench-analytics-events.md                         │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 2: Generator: create Prometheus bridge + tests                 │
│  Outputs: server/observability/<feature>-metrics.ts + router wiring  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 3: Generator: create baseline Grafana dashboard JSON           │
│  Outputs: deploy/observability/grafana/<feature>-dashboard.json      │
└─────────────────────────────────────────────────────────────────────┘
```

**Estimated time with golden path:** ~30 minutes (vs ~90 minutes actual)

---

## Recommendations

### Immediate (This Sprint)

| Action | Effort | Impact |
|--------|--------|--------|
| Document Prometheus scrape endpoint(s) for Console Workbench metrics | ~30m | Makes SLOs immediately actionable |
| Add a Workbench alert rules file mirroring incident lifecycle style | ~45m | Enables early detection for regressions |

### Near-Term (Next 2 Sprints)

| Action | Effort | Impact |
|--------|--------|--------|
| Add durable `draftId` + `runId` plumbing (server-backed or deterministic client IDs) | 0.5–1d | Enables reliable funnels + success metrics |
| Add a small generator for “feature metrics module + dashboard skeleton” | 1–2d | Removes repeated manual work for future dashboards |

### Strategic (Roadmap)

| Action | Effort | Impact |
|--------|--------|--------|
| Create a shared “Console observability framework” package (metrics registry + endpoint) | 2–4d | Standardizes metrics and reduces drift |

---

## Metrics

| Metric | Value | Target | Notes |
|--------|-------|--------|-------|
| Artifacts produced | 6 | — | Dashboard + server bridge + client emitter + SLO doc + checkpoints |
| New tests added | 2 | — | One server router test; one client lib test |

---

## Key Takeaway

> **For Workbench observability, a lightweight telemetry→Prometheus bridge is the fastest path to actionable Grafana dashboards and SLOs without over-building an analytics platform.**

---

## Plan Alignment (Mandatory)

- Plan drift observed:
  - The plan’s dashboard path differs from repo conventions (`deploy/observability/grafana/...`).
  - SLO definitions require an explicit Prometheus exporter layer (not just client instrumentation).
- Plan update(s) to apply next time:

```text
Phase 4.5.2 must include a Console server telemetry ingestion + Prometheus export endpoint (so Grafana/SLOs have real series).
Store Workbench dashboards under deploy/observability/grafana/ to match existing assets.
```

- New preflight steps to add:
  - Confirm Prometheus scrapes `/api/workbench/metrics` in the target environment before treating SLOs as live.

---

## Improvements / Capabilities That Would Help Next

| Type | Proposal | Effort | Expected Impact |
|------|----------|--------|-----------------|
| Tooling | Generator: “feature metrics bridge + test harness” | 1–2d | Faster, consistent observability implementation |
| Tooling | Generator: baseline Grafana dashboard from metric prefix | 1d | Reduces dashboard JSON hand-editing |
| Docs | Console “metrics scrape endpoints” runbook | ~30m | Removes ambiguity in SLO activation |

---

## Follow-Up Actions

- [ ] Update `/retrospectives/PATTERNS.md` with any recurring patterns
- [ ] Add recommendations to `/retrospectives/IMPROVEMENTS.md` with IDs

