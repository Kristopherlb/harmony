# Bug: Workbench applied workflow disappears from canvas

**Status:** Open  
**Reported:** 2026-02-02  
**Area:** Console – Workbench (Phase 4.1)  
**Severity:** High (blocks core chat-to-canvas flow)

---

## Summary

After the user approves an agent proposal (clicks **Apply** on the "Apply agent proposal?" dialog), the workflow that was visible on the canvas disappears and the UI shows the empty state ("No workflow yet") instead of the applied workflow. The same behavior occurs whether the workflow was generated from chat (e.g. "Create a 3-step workflow: trigger, Slack message, Jira ticket") or started from a Library template.

---

## Steps to reproduce

1. Open **Workbench** (`/workbench`).
2. In the AI Agent chat, send: **"Create a 3-step workflow: trigger, Slack message, Jira ticket."**
3. Wait for the agent to propose a workflow. The proposal appears on the canvas and the **"Apply agent proposal?"** dialog opens.
4. Click **Apply** on the dialog.
5. **Observe:** The dialog closes and the canvas shows **"No workflow yet"** (empty state) instead of the applied workflow.

**Alternative flow (template):**

1. Open **Library** (`/workbench/library`).
2. Click **Use template** on any template (e.g. Incident Response).
3. If an Apply dialog appears and the user clicks **Apply**, the same disappearance occurs. (If templates are applied directly to history without a dialog, this path may not show the bug.)

---

## Expected behavior

- After clicking **Apply**, the proposed workflow remains on the canvas as the current draft.
- The user can continue to edit the workflow (nodes, edges, properties) and use undo/redo.
- The empty state should not appear once a draft has been applied.

---

## Actual behavior

- After clicking **Apply**, the canvas clears and shows the empty state ("No workflow yet" with "Browse templates").
- The applied workflow is not visible and cannot be edited until the user generates a new proposal or loads a template again.

---

## Technical context

- **Relevant code:** `packages/apps/console/client/src/pages/workbench-page.tsx`
- **State model:** `displayDraft = pendingDraft ?? currentDraft`. The canvas shows `DraftingCanvas` when `displayDraft` is truthy, otherwise `EmptyState`.
- **Apply flow:** On Apply, the code commits the pending draft to history (`draftHistory` / `historyState`) and advances `historyIndex`, then clears `pendingDraft`. The bug indicates that after clearing `pendingDraft`, `currentDraft` (derived from `historyState.drafts[historyState.index]`) is null or undefined in at least one render, so `displayDraft` becomes null and the empty state is shown.
- **Attempted fixes (so far):**
  - Using `flushSync` to commit history before clearing pending.
  - Deferring `setPendingDraft(null)` to `requestAnimationFrame` so the commit is painted first.
  - Skipping `rejectProposal()` when closing the dialog after Apply (via `applyingProposalRef`).
  - Refactoring to a single `historyState: { drafts, index }` so drafts and index update atomically.

The issue persists after these changes, so the root cause may involve:

- React batching or commit order (e.g. a re-render where `historyState` has not yet been updated when `pendingDraft` is cleared).
- The AlertDialog's `onOpenChange(false)` or unmount triggering a state reset or extra render.
- Another subscriber or effect that clears history or resets index when the dialog closes.

---

## Acceptance criteria for fix

- [ ] User can type "Create a 3-step workflow: trigger, Slack message, Jira ticket", click **Apply**, and the workflow remains on the canvas.
- [ ] User can apply a workflow from a template (if that path shows a dialog) and the workflow remains on the canvas.
- [ ] No flash of "No workflow yet" after Apply.
- [ ] Undo/redo and canvas edits work as expected after Apply.

---

## Environment

- Console app: `pnpm dev:console` (Workbench route).
- Browser: (specify if known).
- Node: v25.4.0 (from earlier context).

---

## Related

- Phase 4.1 Library UX retrospective: `retrospectives/sessions/2026-02-02-workbench-ux-phase-4.1-library-ux.md`
- Workbench QA doc: `docs/workbench-qa-phase-4.1.md`
- ADR-003 Workbench state model: `docs/adr/ADR-003-workbench-state-model.md`
