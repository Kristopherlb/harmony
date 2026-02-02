<!-- path: .cursor/skills/temporal-signals-and-queries/references/temporal-signals-and-queries.md -->

# Temporal Signals & Queries Standard (TSQ-001)

| Metadata | Value |
| --- | --- |
| ID | TSQ-001 |
| Version | 1.0.0 |
| Status | DRAFT |
| Authors | Platform Engineering |
| Context | Temporal workflows (Blueprints): event-driven progress via Signals/Queries |

## 1. Scope

This standard defines how Harmony workflows use Temporal **Signals** and **Queries** to:

- accept external input deterministically (signals)
- expose workflow state for UI/automation (queries)
- replace polling with `condition()` waiting

Out of scope:

- non-workflow runtime (activities, HTTP handlers) except where it drives signals
- vendor-specific payload schemas (Slack, GitHub, etc.)

## 2. Terms

- **Signal**: asynchronous message delivered to a running workflow execution.
- **Query**: read-only request to inspect workflow state at a point in time.
- **Handler**: workflow function registered via `setHandler` that processes signals/queries.
- **Gate**: pattern where workflow blocks until external approval/cancel/continue event.

## 3. Normative requirements

### 3.1 Payload serialization

- **REQ-TSQ-001**: Signal payloads MUST be JSON-serializable.
- **REQ-TSQ-002**: Query return values MUST be JSON-serializable.
- **REQ-TSQ-003**: Payloads SHOULD be versionable via additive fields; avoid breaking renames.

### 3.2 Handler purity and determinism

- **REQ-TSQ-010**: Signal/query handlers MUST be deterministic.
- **REQ-TSQ-011**: Handlers MUST NOT call network, filesystem, `Date`, `Math.random`, or timers.
- **REQ-TSQ-012**: Handlers MUST only mutate workflow-local state.

### 3.3 Registration ordering

- **REQ-TSQ-020**: Workflows MUST register signal/query handlers before any wait that depends on them.
- **REQ-TSQ-021**: Queries SHOULD always be registered even if only used by Console/Slack, to support observability/debugging.

### 3.4 Waiting pattern

- **REQ-TSQ-030**: Workflows MUST use `condition(() => predicate, timeout)` for event-driven waiting.
- **REQ-TSQ-031**: Workflows MUST NOT implement polling loops for external events.
- **REQ-TSQ-032**: On timeout, workflows MUST transition state into a terminal timeout status and return/throw deterministically.

### 3.5 Contract naming

- **REQ-TSQ-040**: Signal/query names are workflow contracts and MUST remain stable once released.
- **REQ-TSQ-041**: Names SHOULD be descriptive and scoped (e.g., `approval`, `approvalState`).

## 4. Reference pattern: HITL approval gate

Harmony’s canonical example is `packages/core/src/wcs/approval-signal.ts`:

- signal: `approval` with `ApprovalSignalPayload`
- query: `approvalState` returning `ApprovalState`
- helper block-kit generators: `createApprovalBlocks`, `createApprovalResultBlocks`

### 4.1 Minimal canonical shapes (illustrative)

Signal payload should include:

- **decision**: `'approved' | 'rejected'`
- **approver identity**: `approverId`, `approverRoles`, optional `approverName`
- **audit**: `timestamp`, `source`, optional `reason`

Query state should include:

- **status**: `'pending' | 'approved' | 'rejected' | 'timeout' | 'cancelled'`
- **requestedAt** + gate params: `requestReason`, `requiredRoles`, `timeout`
- **decision** once present
- optional external references (Slack message identifiers) when applicable

## 5. Testing guidance

### 5.1 Unit tests for helpers and contracts (fast)

For pure helpers (e.g., Block Kit builders) and error classes, write standard unit tests (Vitest) like:

- `packages/core/src/wcs/approval-signal.test.ts`

### 5.2 Temporal workflow tests (integration-level)

When testing end-to-end:

- Start a test workflow
- Assert it blocks in a `pending` state
- Send a signal (`client.workflow.signal(...)`)
- Assert the workflow continues and/or the query reflects the new terminal state

Key properties:

- ensure tests cover **approved**, **rejected**, and **timeout** cases
- ensure query output is stable and serializable

## 6. Common pitfalls (and fixes)

- **Pitfall**: Registering `setHandler` after waiting.
  - **Fix**: register handlers immediately at workflow start or before the first wait.

- **Pitfall**: Returning complex classes in queries.
  - **Fix**: return plain objects; serialize errors into `{ code, message }`.

- **Pitfall**: Using time directly in workflow code.
  - **Fix**: use BaseBlueprint deterministic wrappers (WCS-001, DGS-001).

## 7. Changelog

### 1.0.0

- Initial draft for typed Signals/Queries, determinism constraints, waiting, and testing.

