# Workbench IR Validation and Error Surfacing

**Purpose:** Validation rules and user-facing error surfacing for the Chat→IR contract (`spec/workbench-ir.schema.json`). Use when implementing agent output validation and draft-apply logic.

---

## 1. Validation Rules

### Full draft (BlueprintDraft)

- **title:** Required, non-empty string.
- **nodes:** Array of nodes; each node must have unique `id` within the draft; `id`, `label`, `type` required.
- **edges:** `source` and `target` must reference existing node `id`s.
- **Referential integrity:** Every edge's `source` and `target` must exist in `nodes`.

### Edit intents (per intent)

- **add:** `node.id` must not already exist in the draft. If `afterNodeId` or `connectFrom` is set, that node must exist.
- **remove:** `nodeId` must exist in the draft. Applying remove should also remove edges that reference this node.
- **rename:** `nodeId` must exist.
- **reorder:** All `nodeIds` must exist and exactly match the current set of node ids (or the intended ordering subset).
- **connect:** `source` and `target` must exist; duplicate edges (same source+target) may be allowed or normalized per product rule.
- **branch:** `fromNodeId` must exist; each `branches[].node.id` must be new; `connectTo` in branches must exist or be created in same batch.
- **configure:** `nodeId` must exist; `properties` is merged into the node's existing `properties`.

### Cross-draft consistency

- After applying a sequence of edit intents, the resulting draft must pass full BlueprintDraft validation (referential integrity, unique node ids).

---

## 2. User-Facing Error Surfacing

| Validation failure | User-facing message (example) | Where to show |
|--------------------|-------------------------------|----------------|
| Invalid or missing intent field | "I couldn't apply that change: the request was invalid." | Chat reply |
| Node id not found (remove/rename/configure/reorder/connect) | "That step doesn't exist in the current workflow." | Chat reply |
| Duplicate node id (add) | "A step with that id already exists." | Chat reply |
| Edge references missing node | "Couldn't connect steps: one of them was not found." | Chat reply |
| Schema validation failure (full draft) | "The workflow draft from the assistant was invalid. Please try again or edit manually." | Chat + optional toast |
| Partial apply (e.g. 2 of 3 edits failed) | "Applied 2 changes; 1 failed: [reason]." | Chat reply |

**Guidance:**

- Prefer short, actionable messages. Avoid raw schema keywords (e.g. "required property 'nodeId'") in the UI.
- Log full validation errors server-side (or in dev console) for debugging.
- If the assistant produced invalid IR, suggest "Try rephrasing" or "Edit the step manually on the canvas."
