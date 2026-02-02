# Workbench UX Spec Pack

**Purpose:** Lock shared definitions so engineering and design don't re-litigate terminology, approval tiers, and mode behavior. Single source of truth for build/run UX, approval policy, and glossary.

**Owner:** Product + Design + Platform  
**Last updated:** 2026-02-02

---

## 1. Glossary

| Term | Definition |
|------|------------|
| **Workflow** | A multi-step automation that can be executed (e.g. by Temporal). In the workbench, a workflow is designed as a **draft** and may later be saved as a **blueprint** or run directly. |
| **Blueprint** | A registered, versioned workflow definition (code + descriptor). Blueprints are discoverable (e.g. in MCP/tool catalog) and can be executed. The workbench helps users create or refine **drafts** that may become blueprints. |
| **Draft** | The in-progress workflow representation in the workbench: nodes, edges, title, summary. Stored in memory or session; not persisted as a blueprint until the user explicitly saves. Synonymous with "workflow draft" or "canvas state." |
| **Template** | A pre-built workflow draft (or subflow) stored in the library. Users can insert a template into the workbench as a new draft, then customize. Templates have metadata (id, name, description, domain, tags). |
| **Step / Node** | A single unit of work in a workflow (e.g. "Send Slack message," "Create Jira ticket"). On the canvas, each step is a **node**; nodes are connected by **edges**. |
| **IR (Intermediate Representation)** | The structured representation of the workflow that the assistant produces or edits—i.e. the **draft** in a serializable form (e.g. BlueprintDraft JSON). Chat-driven edits and template insertion both operate on this same IR; the canvas is a visual view of it. |

---

## 2. Approval / Confirmation Policy

Risk tiers determine whether the system **proposes** a change, **applies** it automatically, or **requires explicit approval** before applying.

| Tier | Behavior | When used |
|------|----------|-----------|
| **Propose** | Assistant suggests a change (e.g. draft or edit); user must explicitly accept or reject. No side effects until acceptance. | Default for generative drafts, template insertion, and chat-driven edits that alter the draft. |
| **Apply** | Low-risk action is applied immediately (e.g. rename step, reorder). Optional undo available. | Safe, reversible edits that don't call external systems or change security posture. |
| **Require approval** | Action is blocked until the user (or designated approver) approves. Used for RESTRICTED tools and high-impact operations. | Tool classification = RESTRICTED; or policy flags (e.g. production deploy, sensitive data). |

**Implementation notes:**

- **RESTRICTED** tools (from capability/tool catalog) always use **require approval**: user sees an approval UI (e.g. modal or approval queue) with context (tool IDs, optional incident/workflow ID). Approval events are logged (Phase 4.1.5).
- **Propose** is the default for: new draft from chat, template insertion, and structural edits (add/remove/connect nodes) so the user can review before committing.
- **Apply** may be used for trivial edits (e.g. label change) per product/design agreement; document any such allowlist in this spec or in ADR.

---

## 3. UX Modes: Build vs Run

| Mode | Purpose | Persistence |
|------|---------|-------------|
| **Build** | User is designing or editing a workflow (canvas + chat). Draft is the source of truth; no execution yet. | Draft lives in workbench state (session). Not persisted as a blueprint unless user chooses "Save" or "Run" (which may persist or run in memory depending on implementation). |
| **Run** | User has triggered execution (or is monitoring a run). Canvas may show live state (active/completed/failed nodes); chat may stream execution updates. | Execution state is ephemeral or stored in execution store; draft that was run may remain in session or be saved. |

**Persistence rules:**

- **Build:** Edits (chat or canvas) update the in-memory draft. Undo/redo applies to draft state (see ADR-workbench-state-model). No auto-save to server unless we add it; current expectation is session-scoped.
- **Run:** Starting a run may require the draft to be "accepted" (proposal approved). Run is keyed by execution ID; workbench may show a read-only or live view of that execution.
- Switching from Build to Run (or back) does not discard the draft unless the user navigates away or clears the canvas per product rules.

---

## 4. References

- [Workbench UX Strategy](workbench-ux.md)
- [Workbench UX Research](workbench-ux.research.md)
- ADR-workbench-state-model (Pre-work 3.7)
- Chat→IR Contract: `spec/workbench-ir.schema.json` (Pre-work 3.6)
