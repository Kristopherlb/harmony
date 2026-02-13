# ADR-004: Workbench Draft Execution Model and Node Correlation

| Metadata | Value |
| --- | --- |
| ID | ADR-004 |
| Version | 1.0.0 |
| Status | PROPOSED |
| Authors | Platform Engineering |
| Date | 2026-02-11 |
| Context | Workbench “canvas to cockpit”: run drafts, map live execution to nodes, and surface fixable preflight issues |
| Supersedes | — |

---

## 1. Decision Summary

Define a deterministic **Draft Execution Model** for the Workbench that allows a user to run the **current draft** (not only pre-registered Blueprints) while reliably mapping runtime progress back to canvas nodes using a stable `node_uuid` correlation strategy.

This ADR establishes:

- A **preflight contract** (what must be validated before execution).
- A **node identity** invariant (`node_uuid` is stable within a draft).
- An **execution correlation** invariant (every executed step carries `node_uuid` metadata).
- A **progress derivation** strategy (Temporal history → `stepsByNodeUuid` status).

---

## 2. Context & Problem Statement

### 2.1 Current State

- Workbench users can generate and edit a `BlueprintDraft` on the canvas.
- Users can run **registered Blueprints** (via a picker) but cannot reliably run the **current draft**.
- Execution monitoring exists (polling + history-derived progress), but mapping back to nodes is not defined as a contract.
- “Preflight” checks exist in parts of the UX (unknown tool types, restricted tool gating), but there is no unified, actionable report.

### 2.2 Desired State

- Users can run the current draft with a single action (“Run”) and see per-node status updates directly on the canvas.
- If a draft is not runnable (missing fields, unknown tool types, restricted steps), the UI provides a **Fix-it loop**: click a finding → focus the node → open the config sheet → resolve.
- The runtime mapping is deterministic and testable: a step’s lifecycle is always attributable to one `node_uuid`.

---

## 3. Decision Drivers

| Driver | Weight | Rationale |
| --- | --- | --- |
| End-user trust | High | A cockpit UX must show what ran, what failed, and why, without ambiguity. |
| Determinism | High | Draft execution and progress mapping must be stable and reproducible. |
| Debbugability | High | Failures must point to a node and a missing field; not a generic error. |
| Security & governance | Medium | Restricted/critical steps must be gated and auditable. |
| Incremental delivery | Medium | Must land MVP without requiring full “Blueprint-as-step” composition first. |

---

## 4. Proposed Solution

### 4.1 Node identity (`node_uuid`)

**Decision:** Every draft node must have a persistent identifier `node_uuid` used as the canonical correlation key across:

- Workbench draft (canvas)
- Preflight findings
- Execution steps
- Progress/status snapshots

`node_uuid` is stable for the node’s lifetime within the draft. If a node is duplicated, it must get a new `node_uuid`.

### 4.2 Preflight contract (runnability gate)

**Decision:** “Run” requires a preflight pass that returns a structured set of findings:

- Unknown tool types (node `type` not found in MCP tool catalog)
- Missing required properties (based on the tool’s `inputSchema.required`)
- Restricted/critical policy results (approval required / self-ack / audit-only)

Preflight findings must include `node_uuid`, `tool_id`, and a `field_path` where applicable.

### 4.3 Execution mapping (node → step)

**Decision:** Each executed step must carry the node’s `node_uuid` in metadata. For Temporal-based execution, this means:

- The scheduled activity input contains the `capId` and `node_uuid`
- Progress derivation can read `node_uuid` for each scheduled activity

### 4.4 Progress derivation (Temporal history → stepsByNodeUuid)

**Decision:** The server derives step progress from Temporal history events and returns:

- Per-step status (`pending` | `running` | `completed` | `failed`)
- A stable `node_uuid` correlation key for each step

The client paints node status via a selector like `stepsByNodeUuid[node_uuid].status`.

### 4.5 Fix-it UX (preflight findings → focused repairs)

**Decision:** The Workbench UI exposes a “Fix-it” flow:

- Findings are clickable
- Click → selects/highlights the node → opens `NodeInfoSheet` → focuses the missing field control

This turns preflight into a guided repair loop, not a passive list.

---

## 5. Alternatives Considered

### 5.1 Use Temporal `activityId` as correlation key

| Pros | Cons |
| --- | --- |
| Easy to read from history | Not stable across re-runs; not meaningful to users; breaks when steps are reordered |

**Decision:** Rejected. We need a node-centric contract.

### 5.2 Infer mapping from `capId` order only

| Pros | Cons |
| --- | --- |
| Minimal data passed | Ambiguous when multiple nodes use same capability; fails with parallelism |

**Decision:** Rejected. Correlation must be explicit.

---

## 6. Consequences

### 6.1 Positive

- Deterministic, testable mapping from runtime progress → canvas nodes.
- Fix-it UX reduces friction and increases completion rates.
- Enables future features like template save, blueprint composition, and audit policies without redoing mapping.

### 6.2 Negative

- Requires schema updates for draft nodes (ensure `node_uuid` exists everywhere).
- Requires changes to workflow execution input and progress derivation.

---

## 7. Verification

### 7.1 Unit Tests

- Preflight: missing required fields produces findings with `node_uuid` and `field_path`.
- Correlation: progress derivation yields `node_uuid` for each step when metadata is present.

### 7.2 Acceptance Criteria

- [ ] Clicking a preflight finding focuses the corresponding node and opens configuration.
- [ ] Running a draft updates node states live without leaving Workbench.
- [ ] If a step fails, the failure is attached to the correct `node_uuid`.

---

## 8. References

- `docs/adr/ADR-003-workbench-state-model.md`
- `packages/apps/console/client/src/pages/workbench-page.tsx`
- `packages/apps/console/client/src/features/workbench/use-workflow-progress.ts`
- `packages/apps/console/server/http/workflow-progress.ts`

