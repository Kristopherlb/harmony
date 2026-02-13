# Workbench Approval Context Contract

**Purpose:** Define the minimum context required for an approval to be reviewable and auditable across Workbench, Operations Hub, and Slack interactive approval surfaces.

**Owner:** Platform Engineering  
**Last updated:** 2026-02-11

---

## 1. Principles

- **Actionable approvals**: an approver must be able to make a decision without hunting for missing information.
- **Least disclosure**: include identifiers and summaries, not sensitive payloads.
- **Cross-surface consistency**: the same context fields must appear in Workbench approval history, Operations Hub approval cards, and Slack approval blocks.

---

## 2. Required fields (minimum viable approval item)

### 2.1 Approval identity

- **approverId**: who approved/rejected (or who self-acknowledged).
- **timestamp**: when the approval decision (or acknowledgement) was recorded.
- **approvedToolIds[]**: the tool IDs covered by this approval decision (non-empty).

### 2.2 Review context (at least one should be present)

At least one of these fields must be provided so the approval can be linked back to a runnable artifact:

- **workflowId**: the running workflow execution identifier
- **incidentId**: incident identifier (if incident-scoped)
- **draftTitle**: human-readable name of the draft that prompted the approval

### 2.3 Optional (recommended for reduced context switching)

- **contextType**: enum-like string (e.g. `incident` | `general` | `deployment_failure`)
- **serviceTags[]**: if known, the impacted service tags
- **runId**: Temporal run id (when applicable)
- **reasoning**: user-provided justification (or link to reasoning record)

---

## 3. Examples

### 3.1 Workbench restricted tool approval log entry

```json
{
  "id": "approval-1739234790000-1",
  "approverId": "user:kb",
  "timestamp": "2026-02-11T12:34:56.000Z",
  "approvedToolIds": ["golden.jira.issue.create"],
  "context": {
    "draftTitle": "Incident triage and comms",
    "workflowId": "workbench.draft-run-abc123",
    "contextType": "incident"
  }
}
```

---

## 4. Policy integration

Approval context is orthogonal to *policy decisions* (audit-only vs self-ack vs peer approval). Policy should always record context even when it does not block execution (audit-only).

---

## 5. References

- Enforcement spec: `docs/workbench/SPEC-Approval-Context-Enforcement.md`
- Workbench approval log: `packages/apps/console/server/audit/approval-log.ts`
- Workbench approvals router: `packages/apps/console/server/routers/workbench-router.ts`
- Operations Hub executions: `packages/apps/console/shared/schema.ts` (`WorkflowExecution.context`)

