# SPEC: Approval Context Enforcement

Status: Approved  
Scope: `POST /api/workbench/approvals/log` server-side contract enforcement and cross-surface reviewability

Skills used:

- `test-driven-development`
- `clean-architecture`
- `.cursor/skills/feature-golden-path/SKILL.md`

---

## 1. Objective

Ensure approval log entries are actionable and auditable by enforcing minimum context server-side, not only in documentation.

---

## 2. Normative Contract

For each approval log entry:

- `approvedToolIds` MUST be a non-empty array.
- At least one context field MUST be present and non-empty:
  - `context.workflowId`
  - `context.incidentId`
  - `context.draftTitle`

Reject semantics:

- If `approvedToolIds` is empty, API MUST return `400`.
- If all required context fields are missing or empty, API MUST return `400`.
- Error payload SHOULD include a stable `error` code and a human-readable `message`.

---

## 3. Cross-Surface Consistency

Accepted context fields map to these surfaces:

- Workbench approval history
- Operations Hub approval queues
- Slack interactive approval blocks

Any future surface MUST preserve the same minimum-context requirement.

---

## 4. Implementation Touchpoints

- `packages/apps/console/server/routers/workbench-router.ts`
- `packages/apps/console/server/audit/approval-log.ts`
- `packages/apps/console/server/routes.test.ts`
- `packages/apps/console/server/routes.postgres.int.test.ts`

---

## 5. Validation

Contract checks:

- Unit/integration tests verify `400` on missing context.
- Positive tests verify `201` when at least one required context field exists.

Local smoke checks:

- Manual submit from Workbench approval flow logs context-rich entries.
- `GET /api/workbench/approvals/log` returns entries with the same context values.

