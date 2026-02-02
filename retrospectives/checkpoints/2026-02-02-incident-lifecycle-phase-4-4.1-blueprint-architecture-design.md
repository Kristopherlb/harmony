## Progress
- [x] Todo completed: Phase 4.1 Blueprint Architecture Design (architect-workflow-logic)
- [x] Added architecture plans:
  - `plans/incident-lifecycle/architectures/blueprints.incident.initiate.architecture.json`
  - `plans/incident-lifecycle/architectures/blueprints.incident.remediate.architecture.json`
  - `plans/incident-lifecycle/architectures/blueprints.incident.close-out.architecture.json`
  - `plans/incident-lifecycle/architectures/blueprints.incident.post-mortem.architecture.json`

## Learnings
- The existing Nx blueprint generator expects `input_mapping` to reference only `context.*` (workflow input) or `steps.*` (prior outputs). That implies “constant” capability inputs (e.g., `operation: "sendMessage"`) must be supplied via workflow input unless generator semantics are extended.
- Slack-based approval role-gating is currently limited because Slack interactive approvals send `approverRoles: []` (so role-restricted `waitForApproval(requiredRoles=[...])` would ignore Slack approvals).

## Friction
- Generator plan format is a good AST, but lacks a first-class constant/literal mapping mechanism, which creates noisy workflow input schemas.
- `BaseBlueprint.executeById()` always uses the memo `GoldenContext` for capability execution, so workflow-local incident context updates won’t automatically propagate to capability execution context without additional platform/memo plumbing.

## Opportunities
- Extend the blueprint generator mapping language to support deterministic constants (e.g., `const:` or `literal:`) so architecture plans can stay concise and workflow inputs stay minimal.
- Add an incident “context propagation” helper in `BaseBlueprint` (or a local override) to allow a workflow to safely enrich the `GoldenContext` passed to downstream capability executions without breaking determinism.

## Plan Alignment
- Plan drift: none (architecture artifacts produced; format aligns with existing generator expectations, with noted limitations).
- Proposed plan updates:
  - Add a subtask in Phase 4.1: “Decide constant-mapping strategy for generator (inputs vs generator enhancement)” to prevent churn during blueprint implementation.

## Improvements / Capabilities That Would Help Next
- A `@golden/path` generator enhancement for constant input mappings (deterministic).
- A CI test ensuring Slack approval role claims are populated (or explicitly documented as not yet supported).
