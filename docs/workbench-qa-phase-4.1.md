# Workbench QA – Phase 4.1 (Library UX)

**Scope:** What shipped in Phase 4.1 and how to test it.  
**Context:** The workbench chat is currently **workflow-generation only**; it does not list capabilities or answer “what can you do?” — see “Capabilities vs workflows” below.

---

## What you can test (QA checklist)

### 1. Library page (`/workbench/library`)

- [ ] **Navigate:** Header has a “Library” link → goes to `/workbench/library`.
- [ ] **Catalog:** Page shows template cards (e.g. Incident Response, Daily Standup, Service Health Check) from `packages/core/src/templates/catalog`.
- [ ] **Filters:** Search by name/description/tags; filter by domain/type/classification if present.
- [ ] **Detail:** Clicking a template opens detail (summary, nodes/steps); “Use template” is available.
- [ ] **Use template:** “Use template” navigates to `/workbench?templateId=<id>` and the workbench loads with that template as a **pending draft** on the canvas (no apply dialog; it’s pre-loaded).

### 2. Template insertion flow

- [ ] From Library, click “Use template” for any template → land on Workbench with canvas populated from that template.
- [ ] Edit nodes on the canvas (e.g. change label, properties); state persists.
- [ ] Optional: Ask in chat to refine the workflow; accept/reject proposal and confirm canvas updates.

### 3. Workbench empty state and navigation

- [ ] Open Workbench with no draft: empty state shows “No workflow yet” with “Browse templates” and short description.
- [ ] “Browse templates” goes to `/workbench/library`.
- [ ] Placeholder in chat: “Describe a workflow…” (or similar).

### 4. Chat → workflow generation (what the chat *does* do)

- [ ] **Create from description:** e.g. “Create an incident response workflow that notifies Slack and creates a Jira ticket” → assistant proposes a blueprint draft; Accept/Reject dialog; on Accept, canvas shows the workflow.
- [ ] **Refine:** With a draft on canvas, ask e.g. “Add an approval step before the Jira step” → new proposal; Accept/Reject; canvas updates.
- [ ] **Node refinement:** Select a node on canvas; if the info pane supports “Configure with agent,” use it and confirm the chat gets a refinement request.

### 5. Approval history (RESTRICTED tools)

- [ ] **Button:** “Approval history” in the workbench toolbar opens a sheet.
- [ ] **Logging:** When a proposal includes **RESTRICTED** tools and you check “I approve…” and click Apply, an entry is added to the approval log (in-memory; resets on server restart).
- [ ] **Sheet:** Approval history sheet lists entries (approver, time, tools, context if present).

### 6. Regression / layout

- [ ] Resize panels (chat vs canvas); no crashes; state preserved.
- [ ] Undo/redo when available; history behaves as expected.
- [ ] No missing imports or runtime errors (LibraryPage, ApprovalHistorySheet, Button, etc.) on key routes.

---

## Capabilities vs workflows (why “what do I have available?” generates a workflow)

- **Current design:** The workbench chat is built to **generate and refine workflow blueprints**. The backend treats user input as workflow intent and calls the blueprint-generation tool. There is **no** separate “list capabilities” or “what can you do?” flow.
- **So:** Questions like “What do I have available?” or “What can you do?” are interpreted as “create a workflow” and result in a **draft workflow** (which can look like a “fake” workflow if the model invents steps).
- **Where “what’s available” lives today:**
  - **Templates:** Use **Library** (`/workbench/library`) to see pre-built workflow templates.
  - **Capabilities/tools list:** There is no dedicated “Capabilities” or “Tools” view in the workbench UI yet. The MCP tool catalog backs the assistant but is not shown as a browsable list in this phase.
- **Possible future improvements:**
  - **Meta-questions:** Detect “what can you do?” / “list capabilities” and respond with a short text answer (e.g. “I create and refine workflow drafts. Use the Library to see templates.”) instead of calling the blueprint tool.
  - **Tools/Capabilities UI:** Add a “Capabilities” or “Tools” panel/page that lists MCP tools (and/or templates) so users can discover what’s available without asking in chat.

---

## Quick test prompts (workflow-oriented)

Use these to validate chat → canvas behavior; avoid “what do I have available?” for now (see above).

- “Create a simple 3-step workflow: trigger, send Slack message, then create a Jira ticket.”
- “I need a daily standup reminder workflow.”
- “Add an approval step after the first step.”
- “Rename the second step to ‘Notify team’.”

---

## Summary

| Area              | Available to QA? | Notes |
|-------------------|-------------------|--------|
| Library page      | Yes               | Browse, filter, Use template → workbench with draft. |
| Template insertion | Yes               | Template lands as draft on canvas. |
| Chat → blueprint   | Yes               | Describe/refine workflows; no “list capabilities” yet. |
| Approval history  | Yes               | Button + sheet; entries when applying RESTRICTED proposals. |
| Capabilities list  | No                | Not in UI; chat does not answer “what can you do?” with a list. |

Use the Library for “what templates exist” and workflow-style prompts for “what the assistant can do” (generate/refine drafts). A proper capabilities/tools discovery experience is a follow-on feature.
