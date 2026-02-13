# Workbench Golden Path Agent-First — Status Tracker

> Source plan: `.cursor/plans/workbench_golden_path_agent_boost_2e0303b3.plan.md`
>
> Purpose: high-visibility execution tracking with milestone status, risks, blockers, QA coverage, and immediate next actions.

---

## Reporting Cadence

- Update this file after each milestone slice and major PR.
- Keep `Current Focus`, `Blockers`, `Risks`, `QA Coverage`, and `Next Actions` current.
- Maintain weighted progress aligned to user priority order.

## Priority Weighting (for progress roll-up)

- `approval_quality_and_auditability`: 30%
- `time_to_first_successful_run`: 25%
- `first_run_execution_success`: 20%
- `capability_discovery_and_selection_accuracy`: 15%
- `determinism_regen_sync_hygiene`: 10%

## Current Focus

- Milestone 0A: Agent readiness and prerequisites (completed)
- Milestone 0A.1: Project visibility tracker (completed)
- Milestone 0A.2: Living manual QA guide (completed)
- Milestone 0B: Spec pack front-load (completed)
- Milestone 1: Approval API context contract enforcement (completed slice)

## Milestone Status

- `M0A Agent Readiness`: completed
- `M0A.1 Visibility`: completed
- `M0A.2 Manual QA Living Guide`: completed
- `M0B Specification Pack`: completed
- `M0C Guardrails + Baseline`: pending
- `M1 Approval + Draft Run Telemetry`: in_progress
- `M2 Tool Catalog Intelligence V2`: pending
- `M3 Intent Router`: pending
- `M4 Recipe Registry`: pending
- `M5 Outcome Feedback Loop`: pending
- `M6 End-User Agent Golden Path`: pending

## Weighted Progress Snapshot

- `overall_weighted_progress`: 33%
- `approval_quality_and_auditability`: 30%
- `time_to_first_successful_run`: 8%
- `first_run_execution_success`: 5%
- `capability_discovery_and_selection_accuracy`: 22%
- `determinism_regen_sync_hygiene`: 35%

## Quality Signals

- `hallucination_rate_tool_miss`:
  - Definition: `% of assistant proposals/runs referencing tool IDs not present in current tool catalog`
  - Source: preflight unknown tool findings + proposal validation failures
  - Baseline: pending capture in M0C
  - Target trend: down and stable over milestones M2 + M3

- `approval_context_completeness`:
  - Definition: `% approvals containing at least one of workflowId/incidentId/draftTitle`
  - Baseline: pending capture in M0C

- `run_telemetry_parity`:
  - Definition: draft-run emits same start/completion signals as blueprint-run
  - Baseline: pending capture in M0C

## Blockers

- `blocker`: optional MCP resources not currently available in local session
  - `owner`: platform contributor (current implementer)
  - `unblock_action`: continue local-first deterministic validation and capture "external validation pending" where applicable
  - `status`: mitigated (non-blocking)

## Risks

- `risk`: spec drift across docs and implementation
  - `impact`: medium
  - `mitigation`: keep spec updates in same PR as behavior changes; enforce validation matrix
  - `status`: active

- `risk`: optional MCP integrations unavailable locally
  - `impact`: low-medium
  - `mitigation`: local-first fallback path with deterministic tests remains default
  - `status`: active

- `risk`: approval logs without actionable context degrade reviewer confidence
  - `impact`: high
  - `mitigation`: enforce server-side context contract and test rejection semantics
  - `status`: active

## QA Coverage (manual)

- Coverage source: `docs/workbench/workbench-golden-path-manual-qa.md`
- Covered flows:
  - startup and environment checks
  - capability discovery
  - draft generation/refinement
  - preflight/run/approval
  - telemetry and observability
  - sharing and template reuse
- Latest verified milestone: M0 setup phase
- Validation level mapping:
  - `contract`: partial coverage (spec and API contract updates in progress)
  - `local_smoke`: covered for startup/library/chat/run flows
  - `staging_smoke`: pending

## Next 1-3 Actions

1. Complete remaining Milestone 1 telemetry parity implementation and tests for draft-run started/completed event parity.
2. Execute M0C baseline capture (`/api/workbench/metrics` snapshots + telemetry smoke evidence).
3. Begin Milestone 2 `ai_hints` end-to-end round-trip validation and deterministic artifact checks.

