# Workbench Success Metrics (Targets + Measurement)

**Purpose:** Define measurable success criteria for the Workbench “canvas to cockpit” initiative and ensure they map cleanly to existing baseline instrumentation.

**Owner:** Product + Platform  
**Status:** Draft (targets can be refined after baseline capture)  
**Last updated:** 2026-02-11

---

## 1. Metrics by Persona

### 1.1 End User (SRE / on-call)

- **Time to first successful run**: median time from `workbench.session_started` → first `workbench.workflow_run_completed(status=completed)` within the same session.
  - **Target:** -50% vs baseline after Phase 1–2.
- **In-workbench completion rate**: % of runs that complete without navigating away from Workbench surfaces.
  - **Target:** ≥70% for top templates (incident + rollout).

### 1.2 Approver / Reviewer

- **Approval turnaround**: median time from approval requested → approval completed.
  - **Target:** Standard actions: <5 minutes; Critical actions: <15 minutes (dev/staging), <30 minutes (prod).
- **Approval context completeness**: % of approvals that do not require follow-up questions.
  - **Target:** ≥90%.

### 1.3 Adoption (Organization)

- **Template usage rate**: `workbench.template_inserted` / `workbench.draft_accepted`.
  - **Target:** ≥50% for domain teams using the platform weekly.
- **Draft-to-template conversion rate**: number of “save as template” actions / number of accepted drafts.
  - **Target:** ≥10% initially; ≥25% once template governance is in place.

### 1.4 Reliability

- **Workflow run success rate**: completed / started.
  - **Target:** ≥95% for curated templates and blueprints in local + staging smoke.
- **Rollback success rate** (progressive delivery): successful compensations / triggered compensations.
  - **Target:** ≥99% in controlled environments.

### 1.5 Discoverability hygiene

- **Tool discoverability**: % of newly added tools that appear in `/api/mcp/tools` with correct domain/tags and fresh `manifest.generated_at`.
  - **Target:** 100%.

---

## 2. Measurement Sources

- **Telemetry events**: see `docs/workbench-analytics-events.md`.
- **Baseline capture**: see `docs/workbench-baseline-metrics.md`.
- **Approval logs**: Workbench approval log and Operations Hub execution records.

---

## 3. Validation levels (definition of “done”)

- **Contract validation**: schemas, examples, and deterministic artifacts updated (registries + tool catalog).
- **Local runtime smoke**: runs end-to-end locally (Temporal + worker), with progress and failures mapped to nodes.
- **Staging smoke**: runs end-to-end with representative integrations and observable signals.

