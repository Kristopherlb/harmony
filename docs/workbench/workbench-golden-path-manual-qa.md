# Workbench Golden Path Manual QA (Living Guide)

Purpose: step-by-step end-user validation instructions that evolve with implementation. This guide is updated continuously and does not block active development.

---

## Reporting Cadence (living-document policy)

- Update this guide in the same PR as behavior changes.
- Add milestone deltas in section 10 for every completed milestone slice.
- Keep known limitations current to avoid false-negative QA reports.

---

## 1) Prerequisites

- Repo dependencies installed:
  - `pnpm install`
- Console available:
  - `pnpm nx serve console`
- Optional local Temporal path for run flows:
  - Terminal A: `pnpm nx run harmony:dev-up`
  - Terminal B: `pnpm nx run harmony:dev-worker`

Open:

- Console UI: `http://localhost:5000`
- Workbench: `http://localhost:5000/workbench`

---

## 2) Environment Assumptions

- Console server and client are run from the same process (`pnpm nx serve console`).
- Local run-path validation assumes Docker/Temporal services are reachable.
- MCP readiness is required before blueprint-first propose/run validation.

MCP hard-gate commands:

- `pnpm --dir packages/apps/console exec vitest run server/blueprint-first-api-smoke.test.ts`
- `pnpm -w vitest run packages/tools/mcp-server/src/demo/stdio-jsonrpc-client.test.ts`

---

## 3) Quick Health Check

1. Open Workbench.
2. Confirm page loads with chat + canvas.
3. Confirm no blocking error banner appears.
4. Verify tool catalog is present by opening any UI surface that references tools.

Expected:

- Workbench is interactive and does not fail on first load.

If failed:

- Restart console and refresh tools:
  - `pnpm dev:console:restart`
  - Trigger tool refresh from UI or `POST /api/mcp/tools/refresh`

---

## 4) Flow A: Capability Discovery (Discovery intent)

Goal: validate that discovery asks are answered as discovery, not as forced workflow generation.

Steps:

1. In Workbench chat, ask: `What can you do?`
2. Ask: `List available tools for incidents and rollout verification.`
3. Ask: `What should I use to verify a deploy before rollback?`

Expected:

- The assistant returns capability/tool-oriented guidance.
- Responses include catalog-grounded capability IDs from `/api/mcp/tools`.
- The assistant does not auto-create a fake workflow draft for pure discovery questions.

Failure indicators:

- Assistant returns workflow draft without user asking for generation.
- Suggested tools are not in tool catalog.

Discovery fidelity check:

1. Ask: `What security tools do we have available?`
2. Cross-check returned IDs against `GET /api/mcp/tools`.
3. Only continue to Flow B if the response is catalog-grounded.

---

## 5) Flow B: Draft Generation + Iterative Refinement

Goal: validate generate/refine loop from end-user perspective.

Steps:

1. Ask: `Create a workflow to investigate an incident, notify Slack, and create a Jira issue.`
2. Accept the proposal.
3. Ask refinement: `Add an approval step before the Jira step.`
4. Ask refinement: `Rename the final step to Post incident summary.`

Expected:

- Assistant generates a valid draft.
- Acceptance updates canvas.
- Refinements modify existing draft predictably.

Failure indicators:

- Proposal has unknown tool types.
- Applying proposal clears draft unexpectedly.

---

## 6) Flow C: Preflight + Run Current Draft + Approval Context

Goal: validate run path trust, approval gating, and execution observability.

Steps:

1. Open `Run current draft`.
2. Review preflight findings.
3. If restricted tools are detected, approve in UI.
4. Start run.
5. Confirm run status progresses and reaches terminal state.
6. Open approval history and verify context payload is actionable.

Expected:

- Preflight blocks invalid drafts and gives fixable findings.
- Run starts only when preflight is OK.
- Approval entries include actionable context (at least one of workflowId, incidentId, draftTitle).

Failure indicators:

- Run starts with failing preflight.
- Approval log entry is missing context.

---

## 7) Flow D: Telemetry + Observability Validation

Goal: validate that user-visible actions map to measurable metrics.

Steps:

1. Perform one successful draft run and one failed/blocked run attempt.
2. Trigger approval flow at least once.
3. Check telemetry endpoint activity and metrics exposure:
   - `POST /api/workbench/telemetry` requests are emitted
   - `GET /api/workbench/metrics` includes updated counters

Expected:

- Run and approval events appear in metrics.
- Event trends match user actions.

Optional smoke command:

- `pnpm telemetry:smoke:workbench -- --base-url http://localhost:3000`

---

## 8) Flow E: Share + Template Reuse

Goal: validate collaboration/reuse surfaces.

Steps:

1. Use Share action to copy a read-only link.
2. Open link in new tab/session and verify read-only rendering.
3. Save draft as template.
4. Open Library and verify template discoverability.

Expected:

- Shared link loads read-only draft.
- Saved template is visible and reusable.

---

## 9) Known Limitations (living)

- Capability-discovery behavior may still be evolving while intent router rollout is in progress.
- Some observability checks require local Temporal/worker services to be healthy.
- Optional MCP helper surfaces may not be available in all environments.

---

## 10) Milestone Delta Updates

Use this section to log only what changed in QA expectations per milestone.

- `M0`: Initial living guide created. Baseline startup/discovery/generation/run/observability/share flows established.
- `M1`: Added explicit approval-context contract check in Flow C:
  - `POST /api/workbench/approvals/log` now rejects entries that provide no actionable context (`workflowId`, `incidentId`, or `draftTitle`).
- `M2`: Pending.
- `M3`: Pending.
- `M4`: Pending.
- `M5`: Pending.
- `M6`: Added a practical operator-facing golden-path playbook:
  - `docs/workbench/workbench-agent-golden-path.md`
  - Includes quick startup, plan-first steerage prompts, partial refinement templates, safe run checklist, observability checks, and dogfooding loop.

