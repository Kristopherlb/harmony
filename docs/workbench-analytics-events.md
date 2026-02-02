# Workbench Analytics Event Taxonomy

**Purpose:** Standardize instrumentation so success metrics are measurable and consistent across workbench features. Use for Phase 4.5 instrumentation and Phase 5 success metrics.

**Owner:** Platform + Product  
**Last updated:** 2026-02-02

---

## 1. Event Names and Required Properties

All events should include **session** and **timestamp** where applicable. Use consistent names and property keys for aggregation.

| Event | Required Properties | Optional Properties | When to emit |
|-------|---------------------|---------------------|--------------|
| `workbench.session_started` | `sessionId`, `timestamp` | `userId`, `referrer` | User opens workbench page |
| `workbench.session_ended` | `sessionId`, `timestamp` | `durationMs`, `userId` | User leaves or closes workbench |
| `workbench.draft_created` | `sessionId`, `timestamp`, `source` | `draftId`, `nodeCount`, `templateId` | New draft created (source: `chat` \| `template` \| `blank`) |
| `workbench.draft_accepted` | `sessionId`, `timestamp`, `draftId` | `source`, `nodeCount` | User accepts proposed draft (e.g. from chat or template) |
| `workbench.draft_rejected` | `sessionId`, `timestamp`, `draftId` | `source` | User rejects proposed draft |
| `workbench.draft_edited` | `sessionId`, `timestamp`, `draftId`, `editType` | `nodeCount`, `intent` | Draft modified (editType: `chat` \| `canvas` \| `template_insert`) |
| `workbench.template_viewed` | `sessionId`, `timestamp`, `templateId` | `source` (e.g. library \| chat_suggestion) | User views template detail |
| `workbench.template_inserted` | `sessionId`, `timestamp`, `templateId`, `draftId` | — | User inserts template into draft |
| `workbench.chat_message_sent` | `sessionId`, `timestamp` | `messageLength`, `hasAttachment` | User sends chat message |
| `workbench.chat_tool_invoked` | `sessionId`, `timestamp`, `toolId` | `draftId`, `success` | Assistant invokes tool (e.g. proposeWorkflow) |
| `workbench.template_suggested` | `sessionId`, `timestamp`, `templateId` | `draftId`, `accepted` | Assistant suggests template in chat |
| `workbench.workflow_run_started` | `sessionId`, `timestamp`, `draftId`, `runId` | — | User or system starts workflow execution |
| `workbench.workflow_run_completed` | `sessionId`, `timestamp`, `runId`, `status` | `durationMs`, `draftId` | Run finishes (status: `completed` \| `failed` \| `cancelled`) |
| `workbench.approval_requested` | `sessionId`, `timestamp`, `toolIds[]`, `contextType` | `incidentId`, `workflowId`, `draftId` | RESTRICTED tool approval requested |
| `workbench.approval_completed` | `sessionId`, `timestamp`, `approved` | `toolIds[]`, `approverId` | User approves or rejects approval request |

**Identifiers:**

- `sessionId`: Opaque id for the workbench session (e.g. UUID or tab/session key).
- `draftId`: Stable id for the current draft in session (e.g. client-generated UUID for the draft instance).
- `runId`: Execution id from Temporal or backend.
- `templateId`: Id from template catalog.

---

## 2. Privacy and Safety Notes

**Do not log:**

- Full chat message content (unless explicitly required for product and compliant with policy).
- PII in free text (e.g. user names, emails) unless hashed or approved.
- Credentials or tokens.

**Safe to log:**

- Counts (node count, message length buckets).
- IDs (session, draft, run, template) and enum-like fields (source, editType, status).
- Timestamps and durations.

---

## 3. Metric Mapping (Events → Phase 5 KPIs)

| Persona | Phase 5 Metric | Events to use |
|---------|----------------|---------------|
| Agent | Template suggestion rate (30% of chats suggest template) | `workbench.template_suggested` / `workbench.chat_message_sent` (or chat turns) |
| End User | Time to create workflow (-50% vs manual) | `workbench.draft_created` → `workbench.draft_accepted` duration; baseline from docs/workbench-baseline-metrics.md |
| Leadership | Workbench adoption (80% of workflows via workbench) | `workbench.draft_accepted`, `workbench.workflow_run_started` vs other creation sources (if tracked elsewhere) |
| Domain Expert | Template usage rate (50% of workflows use template) | `workbench.template_inserted` / `workbench.draft_accepted` (or runs started with template-origin draft) |

---

## 4. Implementation Notes

- Emit events from client (`workbench-telemetry.ts` or similar) and/or server where appropriate (e.g. approval completed server-side).
- Prefer OpenTelemetry or existing analytics pipeline; keep event names and property keys stable for dashboards (Phase 4.5).
- See `product-management/workbench-ux.spec.md` for glossary (draft, template, etc.).
