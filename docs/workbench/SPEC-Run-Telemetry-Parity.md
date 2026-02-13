# SPEC: Run Telemetry Parity (Blueprint Run vs Draft Run)

Status: Approved  
Scope: ensure draft-run emits equivalent run lifecycle signals to blueprint-run

Skills used:

- `.cursor/skills/feature-golden-path/SKILL.md`
- `test-driven-development`
- `clean-architecture`

---

## 1. Objective

Keep run observability consistent across execution paths so product and ops metrics are comparable.

---

## 2. Parity Requirements

Both run paths MUST emit equivalent lifecycle telemetry:

- `workbench.workflow_run_started`
- `workbench.workflow_run_completed`

Required fields on completion:

- `status` (terminal status)
- `durationMs` (run elapsed time in milliseconds)

Terminal status set MUST include at least:

- `completed`
- `failed`
- `cancelled` (or equivalent terminal cancellation state)

---

## 3. Emission Timing

- `started` event MUST emit after run start is acknowledged by server.
- `completed` event MUST emit after terminal state is observed.
- `durationMs` MUST measure started-to-terminal duration, not poll interval.

---

## 4. Validation and Regression Gates

Contract checks:

- Client/server tests assert both events for draft run path.
- Event payload tests assert `status` and `durationMs`.

Local smoke checks:

- Run one successful draft run and verify both events appear in metrics.
- Run one failed or blocked run and verify terminal event parity.

---

## 5. Implementation Touchpoints

- `packages/apps/console/client/src/features/workbench/run-draft-dialog.tsx`
- `packages/apps/console/client/src/features/workbench/run-blueprint-dialog.tsx`
- `packages/apps/console/server/observability/workbench-metrics.ts`
- `docs/workbench-analytics-events.md`

