# Workbench Usability Testing – Phase 4.4 (Collaboration & Polish)

**Scope:** Validate Phase 4.4 UX improvements: sharing, onboarding/help, and large-draft performance affordances.  
**Audience:** Product/Design/Platform evaluators running moderated sessions (30–45 min).

---

## Goals

1. **Onboarding**: First-time users understand “chat → draft → canvas → run” in under 5 minutes.
2. **Help discoverability**: Users can find example prompts and the template Library without external guidance.
3. **Sharing**: Users can generate a read-only share link and communicate it to a reviewer.
4. **Reuse**: Users can save a draft as a reusable template and find it in the Library.
5. **Performance (qualitative)**: Canvas interactions remain responsive for medium/large drafts (no obvious jank; no resets of node positions on minor updates).

---

## Participants (recommended)

- **P1: New-ish operator** (has used runbooks/incidents; minimal Workbench exposure)
- **P2: Power user** (has used Workbench chat/canvas before; cares about speed)
- **P3: Reviewer** (does not build workflows; reviews/approves changes)

Target: **5–8 sessions** (enough to find recurring UX friction).

---

## Environment setup (moderator checklist)

- [ ] Console server running (dev)
- [ ] Open Workbench at `/workbench`
- [ ] Ensure onboarding is visible for first-time flow (clear localStorage key):
  - `harmony.workbench.onboarding.v1.seen`
- [ ] Optional: Have a “medium” draft ready (≥20 nodes) to sanity-check canvas responsiveness.

---

## Session outline (30–45 minutes)

### 1) Intro (2–3 min)
- Explain: “We’re testing the product, not you.”
- Ask participant to narrate what they’re thinking.

### 2) Task set (20–30 min)

#### Task A: First-run orientation
- Prompt: “Open Workbench. Tell me what you think this page is for.”
- Success: Participant can articulate: “Use chat/templates to create a draft workflow; edit on canvas; run/share.”

#### Task B: Use a template
- Prompt: “Find a template that looks relevant and load it into the Workbench.”
- Success: Participant finds Library, previews template, and loads it into the Workbench.
- Observe: Do they use navigation vs empty state vs Help panel?

#### Task C: Configure a step
- Prompt: “Pick one step and configure it so it feels ready to run.”
- Success: Participant clicks a node, finds the info pane, and modifies properties (or uses “configure with agent” if available).

#### Task D: Share for review
- Prompt: “Share this draft with me so I can review it without editing.”
- Success: Participant uses Share action and produces a link; understands it’s read-only.

#### Task E: Save for reuse
- Prompt: “Save this workflow so you can reuse it next week, and show me where it lives.”
- Success: Participant uses “save as template” and finds it in the Library.

#### Task F (optional): Performance sanity
- Prompt: “Drag around the canvas, select nodes, zoom/fit. Tell me if anything feels laggy.”
- Success: No major jank; node positions do not unexpectedly reset during simple actions.

### 3) Post-task questions (5–8 min)

- “What was confusing or surprising?”
- “If you had one feature request, what would it be?”
- “How confident are you that you could do this again without help?” (1–5)
- “Would you trust sharing this link for review?” (yes/no + why)

---

## Metrics to capture (per participant)

- **Time-to-first-draft**: start → draft visible on canvas
- **Time-to-share-link**: start task D → link copied
- **Task completion rate**: A–E (pass/fail)
- **Number of wrong turns**: e.g., looking in wrong page/panel, repeated clicks
- **Confidence score** (1–5) after session

---

## Success thresholds (Phase 4.4 exit)

- ≥80% participants complete tasks B–E without moderator intervention
- Median time-to-share-link ≤ 60 seconds once draft exists
- ≥70% participants report confidence ≥ 4/5
- No repeated critical confusion around “read-only share link” meaning

---

## Common failure modes (watch for)

- Users don’t notice Help button / don’t know where to start
- Users assume “Share” implies collaborative editing (it’s read-only)
- Users can’t find saved templates (local-only behavior isn’t obvious)
- Users lose trust if canvas jumps (positions reset) or if UI feels sluggish

---

## Notes & follow-ups

Capture findings in:
- `retrospectives/sessions/2026-02-02-workbench-ux-phase-4.4-collaboration-polish.md` (full retro)
- Add recurring issues to `retrospectives/PATTERNS.md` once observed ≥3 times

