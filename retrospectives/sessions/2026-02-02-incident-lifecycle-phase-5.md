# Retrospective: Incident Lifecycle — Phase 5 (Console UI)

**Date:** 2026-02-02  
**Session Duration:** ~90 minutes  
**Artifacts Produced:**
- `docs/design/incident-console-ux-review.md`
- `packages/apps/console/client/src/pages/incidents.tsx`
- `packages/apps/console/client/src/pages/runbooks.tsx`
- `packages/apps/console/client/src/pages/timeline.tsx`
- `packages/apps/console/server/runbooks/http/runbooks-router.ts`
- `packages/apps/console/shared/schema.ts` (runbooks + execution context extensions)
- Tests:
  - `packages/apps/console/client/src/pages/__tests__/incidents.test.tsx`
  - `packages/apps/console/client/src/pages/__tests__/runbooks.test.tsx`
  - `packages/apps/console/client/src/features/operations-hub/components/__tests__/ApprovalCard.test.tsx`
  - `packages/apps/console/server/runbooks/http/runbooks-router.test.ts`

---

## What Went Well

### 1. Reused existing Console primitives effectively
We built Phase 5 UI by composing the existing `PageLayout`, `shadcn/ui` primitives, and the already-present Actions subsystem. This kept the surface area small and avoided “new framework inside the app.”

### 2. Context propagation unlocked approvals + incident linking
Adding optional execution `context` (eventId/contextType/serviceTags) made the approvals queue actionable: reviewers can now see why/where a request came from and jump to the incident.

### 3. End-to-end tests stayed green while adding new routes
All Console tests remained green after adding routes/pages and server endpoints, and we added focused tests for the new incident/runbook/timeline views.

---

## What Could Have Been Better

### 1. Global skills were not available in the environment
The global skills directory was empty, so Phase 5 UX/TDD guidance had to be applied implicitly rather than by reading `~/.cursor/skills/*`.

**Impact:** Reduced “single source of truth” for UX conventions during implementation.

### 2. Runbooks required repo-root discovery to be reliable
The Console server runs with cwd under `packages/apps/console`, but runbooks live at repo root. We had to introduce workspace-root discovery so `/api/runbooks` works across dev/test/CI.

**Impact:** Minor rework and a small new piece of infrastructure code.

### 3. Timeline/audit is UI-joined (not persisted)
Timeline is currently composed client-side from the activity stream + recent executions. This is good for Phase 5 UX, but it’s not yet a durable “incident audit log” with strong linking guarantees.

**Impact:** Limited fidelity for long-running incidents and historical review.

---

## The Golden Path (If It Existed)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Step 1: Generate Console UI slice (Incidents/Approvals/Runbooks)    │
│  Outputs: Routes + pages + tests + navigation updates                │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 2: Add “execution context” contract once                       │
│  Outputs: shared schema + server mappers + UI components             │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 3: Wire timeline persistence (incident timeline capability)    │
│  Outputs: DB-backed audit feed + incident-scoped queries             │
└─────────────────────────────────────────────────────────────────────┘
```

**Estimated time with golden path:** ~60 minutes (vs ~90 minutes actual)

---

## Recommendations

### Immediate (This Sprint)

| Action | Effort | Impact |
|--------|--------|--------|
| Add a simple markdown renderer for runbook content in Console | 1–2h | Better readability and operator confidence |
| Add an incident-scoped approvals/executions endpoint (`/api/actions/approvals/pending?eventId=...`) | 1–2h | Removes client-side filtering and makes linking deterministic |

### Near-Term (Next 2 Sprints)

| Action | Effort | Impact |
|--------|--------|--------|
| Persist workflow executions (and approval decisions) to a durable store | 0.5–1d | Enables reliable audit/timeline for long-running incidents |
| Add canonical `incidentId` propagated across events + action executions | 0.5d | Strong linking (better than tag-based inference) |

### Strategic (Roadmap)

| Action | Effort | Impact |
|--------|--------|--------|
| Implement a first-class Incident domain model in Console (beyond “event as incident”) | 2–4d | Clear lifecycle state, ownership, and reporting |

---

## Metrics

| Metric | Value | Target | Notes |
|--------|-------|--------|-------|
| Tool calls | ~40 | <60 | Included multi-file edits + tests |
| Clarifying questions | 0 | 0 | Executed directly against existing primitives |
| Artifacts produced | 10+ | 6+ | Included docs + pages + server router + tests |
| User round-trips | 0 | 0 | No blocking questions needed |

---

## Key Takeaway

> **Adding a small, explicit “execution context” contract is the unlock for operator-grade approvals, runbooks, and audit views.**

---

## Plan Alignment (Mandatory)

- **Plan drift observed:** Global UX skill (`ui-ux-pro-max`) was not available to read, so the UX review was captured as a repo-local design doc instead.
- **Plan update(s) to apply next time (copy/paste-ready):**
  - Add Phase 5.0 preflight: “Verify `~/.cursor/skills/ui-ux-pro-max` and `~/.cursor/skills/test-driven-development` exist; if not, rely on repo-local UX review doc + tests.”
  - Add Phase 5.2 note: “Approval queue needs execution context (eventId/serviceTags) to be actionable; ensure execute-action request supports `context` and callers pass it.”
  - Add Phase 5.3 note: “Runbook UI requires server endpoint for listing/reading repo-local `/runbooks`; ensure repo-root resolution is cwd-independent.”
- **New preflight steps to add:**
  - Run `pnpm -w nx test console` after adding any new routes/pages (ensures client+server remain integrated).

---

## Improvements / Capabilities That Would Help Next

| Type | Proposal | Effort | Expected Impact |
|------|----------|--------|-----------------|
| Skill/Docs | Document “Console incident UX” patterns (tabs, context chips, linking) | 1–2h | Faster repeatable UI work |
| Tooling | Markdown renderer component (shared) | 1–2h | Better runbook readability |
| Capability/Generator | Incident-scoped query endpoints + persistence | 0.5–1d | Durable audit and better incident detail pages |

---

## Follow-Up Actions

- [ ] Update `/retrospectives/PATTERNS.md` with any recurring patterns
- [ ] Add recommendations to `/retrospectives/IMPROVEMENTS.md` with IDs

