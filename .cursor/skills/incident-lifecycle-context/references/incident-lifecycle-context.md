# Incident Lifecycle Context — Phase 2 Reference

This reference expands on `incident-lifecycle-context` (ILC-001) with concrete file pointers and recommended usage patterns.

---

## GoldenContext incident fields

Canonical definition:

- `packages/core/src/context/golden-context.ts`

Recommended helper usage:

- `packages/core/src/context/incident-context.ts`

Why this matters:

- Incident fields become the glue across notification systems (Slack/PagerDuty/Statuspage) and serve as durable correlation keys across workflow history.

---

## Approval gates (signals + query)

Contract types and helpers:

- `packages/core/src/wcs/approval-signal.ts`

Execution pattern:

- `BaseBlueprint.waitForApproval(...)` in `packages/core/src/wcs/base-blueprint.ts`

UI / automation introspection:

- Query name: `approvalState` via `approvalStateQuery`
- Include the workflowId as the stable lookup key used by both Console and Slack actions

---

## Slack interactive approvals

Slack message templates (Block Kit):

- `createApprovalBlocks(...)` and `createApprovalResultBlocks(...)` in `packages/core/src/wcs/approval-signal.ts`

Slack callback handler (Express):

- `packages/apps/console/server/integrations/http/slack-interactive-handler.ts`

Design constraints:

- Slack buttons must encode `workflowId` in `value`
- Keep `action_id` stable (contract used by handler)
- Verify Slack signatures before processing

---

## Runbooks and operational remediation

Sample runbooks live under:

- `runbooks/`

Execution is provided by:

- Capability: `golden.operations.runme-runner` (`packages/capabilities/src/operations/runme-runner.capability.ts`)

Runme cell naming:

- Use fenced code blocks with a `name` attribute, e.g.:
  - Example:

```sh { name=verify-access interactive=false }
set -euo pipefail
echo "hello from verify-access"
```

Selecting cells via `golden.operations.runme-runner`:

- Set `sourceType: "file"` and pass `cells: ["verify-access", "postcheck-ready"]` to run specific steps.
- If `cells` is omitted, the capability executes `--all` (all runnable cells).


