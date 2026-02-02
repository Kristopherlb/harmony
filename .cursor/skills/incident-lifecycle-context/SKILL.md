---
name: incident-lifecycle-context
description: Phase 2 incident lifecycle patterns: GoldenContext incident fields, approval gates, Slack interactive approvals, and context propagation across workflows/capabilities.
---

# Incident Lifecycle Context (ILC-001)

Use this skill when you are building or reviewing incident lifecycle automation (initiate → remediate → close-out → post-mortem) and need consistent, discoverable Phase 2 patterns.

## When to Use

- Adding or updating incident workflows that extend `BaseBlueprint`
- Propagating incident metadata through `GoldenContext`
- Implementing HITL approval gates via Temporal signals/queries
- Wiring Slack interactive approvals to waiting workflows

## Quick-start checklist (do this in order)

- Ensure your workflow is started with memo keys:
  - `golden.context` (`GoldenContext`)
  - `golden.securityContext` (`SecurityContext`)
- If creating an incident:
  - Set `incident_id`, `incident_severity`, and `incident_started_at` early
  - Set `incident_channel` when a Slack channel is created/known
  - Persist `pagerduty_incident_id` / `statuspage_incident_id` when created
- For sensitive actions:
  - Use `waitForApproval(...)` and include a clear `reason`
  - Prefer severity-driven timeout via `getApprovalTimeoutForSeverity(...)`
  - Notify Slack using `notifySlackChannel` (usually `incident_channel`)
- Execute work through capabilities (not bespoke side-effect code):
  - Use `executeById(capId, input, ...)`

## GoldenContext incident fields (canonical contract)

Incident metadata is carried in `GoldenContext` (workflow memo key: `golden.context`) and is the shared substrate for:

- Workflow orchestration decisions (severity, SLA, approval timeout)
- Notifications (Slack, PagerDuty, Statuspage)
- Audit context (trace/correlation IDs and incident IDs)

### Fields

Defined in `packages/core/src/context/golden-context.ts`:

- `incident_id`: Unique incident identifier (e.g., `INC-2026-001`)
- `incident_severity`: `P1 | P2 | P3 | P4` (`IncidentSeverity`)
- `incident_title`: Human-readable summary/title
- `incident_channel`: Slack channel ID used for incident comms
- `pagerduty_incident_id`: PagerDuty incident correlation ID
- `statuspage_incident_id`: Statuspage incident correlation ID
- `incident_started_at`: ISO timestamp when incident started
- `impacted_services`: List of impacted service names

### Helper utilities

Use `packages/core/src/context/incident-context.ts` helpers to create and manage incident context:

- `generateIncidentId({ sequence, year?, prefix? })`
- `createIncidentGoldenContext(baseContext, incident)`
- `extractIncidentContext(ctx)` / `hasIncidentContext(ctx)`
- `updateIncidentContext(ctx, updates)`
- `getApprovalTimeoutForSeverity(severity)`

## Context propagation (workflow → capability → integrations)

### Source of truth: workflow memo

In workflow code, `BaseBlueprint` reads from Temporal workflow memo:

- `GOLDEN_CONTEXT_MEMO_KEY = "golden.context"` (for `GoldenContext`)
- `SECURITY_CONTEXT_MEMO_KEY = "golden.securityContext"` (for initiator identity)

`BaseBlueprint.executeById(...)` requires `GoldenContext` to be present in memo, because it is passed to capabilities as `ctx` for consistent policy/telemetry.

### Incident context propagation pattern

When a workflow “enters incident mode”, it should:

- Generate/set `incident_id` and `incident_severity`
- Persist correlation IDs (`pagerduty_incident_id`, `statuspage_incident_id`) as they become available
- Prefer storing incident comms channel (`incident_channel`) so downstream steps can notify/update deterministically

## Determinism + layering (WCS alignment)

- Workflow logic must remain deterministic:
  - Use `this.now`, `this.uuid()`, and `this.sleep(...)` wrappers (no raw `Math.random`, `setTimeout`)
  - Do not perform network I/O directly in workflow code
- Side effects belong in capabilities and activities:
  - Use `executeById(...)` for capability execution (it forwards `GoldenContext` + trace)
  - Slack notifications for approvals are done through `ApprovalNotificationActivity` (not direct Slack API calls from workflow)

## HITL approval gate pattern (Temporal signals/queries)

Harmony’s Phase 2 HITL pattern is provided by:

- `packages/core/src/wcs/approval-signal.ts` (signal/query contract + Slack Block Kit helpers)
- `BaseBlueprint.waitForApproval(...)` (state machine + deterministic waiting + optional Slack notification)

### How it works (high level)

- The workflow registers handlers for:
  - `approvalSignal` (signal name: `approval`)
  - `approvalStateQuery` (query name: `approvalState`)
- The workflow waits via `condition()` until approved/rejected or timeout.
- The approval decision payload (`ApprovalSignalPayload`) is stored in workflow-local state for auditability and UI querying.

### Using `waitForApproval()`

In a blueprint, call:

```typescript
await this.waitForApproval({
  reason: 'Destructive remediation requires approval',
  requiredRoles: ['sre', 'ops-lead'],
  timeout: '30m',
  notifySlackChannel: 'C0123456789',
});
```

Notes:

- If `requiredRoles` is non-empty, `ApprovalSignalPayload.approverRoles` must include at least one required role for the signal to be accepted.
- Severity-based defaults are available via `getApprovalTimeoutForSeverity(severity)` (see `docs/incidents/severity-definitions.md` for the operational policy table).

### Important: role-gating + Slack current behavior

Today, `slack-interactive-handler.ts` sends approval signals with `approverRoles: []` (there is a TODO to fetch roles). That means:

- If you set `requiredRoles` on `waitForApproval(...)`, Slack approvals will be ignored (no matching roles).
- Until Slack role mapping is implemented, prefer either:
  - `requiredRoles: []` for Slack-driven approvals, or
  - Console/API-driven approvals where roles are populated.

## Slack interactive approvals (end-to-end)

### Slack message composition

Use `createApprovalBlocks(...)` to create a consistent Slack Block Kit message:

- Header → reason section → metadata fields → action buttons → optional context
- Buttons are stable contracts:
  - `APPROVAL_ACTION_IDS.APPROVE = "approval_approve"`
  - `APPROVAL_ACTION_IDS.REJECT = "approval_reject"`
  - The button `value` MUST be the Temporal `workflowId`

### Slack callback handler

The console server integration handler:

- `packages/apps/console/server/integrations/http/slack-interactive-handler.ts`

Pattern:

- Parse the interactive payload
- Identify approval action by `action_id`
- Read `workflowId` from button `value`
- Send `approvalSignal` to that workflow via Temporal client
- Acknowledge within 3 seconds

Security note:

- Apply `createSlackVerificationMiddleware(signingSecret)` to prevent forged callbacks.

## Testing guidance (TDD-aligned)

- Incident context helpers have unit tests:
  - `packages/core/src/context/incident-context.test.ts`
- Approval signal/query contracts have unit tests:
  - `packages/core/src/wcs/approval-signal.test.ts`
- When changing behavior (new fields, new approval states, new invariants), write a failing test first and only then implement.

## References

- `docs/incidents/severity-definitions.md`
- `docs/integrations/openapi-specs.md`
- `docs/adr/ADR-002-incident-management.md`
- `packages/core/src/context/golden-context.ts`
- `packages/core/src/context/incident-context.ts`
- `packages/core/src/wcs/approval-signal.ts`
- `packages/core/src/wcs/base-blueprint.ts` (see `waitForApproval`)
- `packages/apps/console/server/integrations/http/slack-interactive-handler.ts`

