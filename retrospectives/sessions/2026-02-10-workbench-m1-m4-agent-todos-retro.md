# Retrospective: Workbench M1/M3/M4 Assigned To-dos

**Date:** 2026-02-10  
**Session Duration:** ~65 minutes  
**Artifacts Produced:**
- `packages/apps/console/server/services/golden-path-recipes.ts`
- `packages/apps/console/server/services/golden-path-recipes.test.ts`
- `packages/apps/console/server/services/openai-agent-service.ts`
- `packages/apps/console/server/agent/prompts/blueprint-generation.ts`
- `packages/apps/console/server/agent/prompts/blueprint-generation.test.ts`
- `packages/apps/console/client/src/features/workbench/draft-mutations.ts`
- `packages/apps/console/client/src/pages/workbench-page.tsx`
- `packages/apps/console/client/src/features/workbench/drafting-canvas.tsx`

---

## What Went Well

### 1. TDD-first behavior changes
Each new behavior path (recipe selector, steerage checkpoint, partial merge, validation visualization) was covered with targeted tests before completion. This kept regression risk low while moving across client/server boundaries.

### 2. Deterministic boundaries preserved
Recipe selection was implemented as deterministic scoring + tie-breaks, and integrated at the prompt boundary rather than adding ad-hoc branching in multiple places.

### 3. Local-first validation flow
Scoped test loops (`server` targeted Vitest + `console:test-client-workbench`) made it possible to finish all five assigned to-dos in one session without pausing for external dependencies.

---

## What Could Have Been Better

### 1. Client/server test command asymmetry
Server default Vitest config and client config use different includes, which caused one failed attempt before switching to the correct client test command.

**Impact:** ~5-8 minutes of avoidable reruns.

### 2. Steerage trigger threshold tuning
Initial steerage heuristic required one calibration pass to avoid skipping the checkpoint in fixture-based evals.

**Impact:** One red/green loop on eval harness behavior.

### 3. Existing dirty worktree noise
Large pre-existing change set made per-task change verification noisier, requiring extra path-scoped status checks.

**Impact:** Slightly slower verification and review.

---

## The Golden Path (If It Existed)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Step 1: Add failing tests for each behavioral to-do               │
│  Outputs: Clear RED baseline (server + client scoped)              │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 2: Implement at durable boundaries                           │
│  Outputs: Selector module, prompt hooks, merge helper, UI states   │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 3: Run fast scoped suites + one integrated client target     │
│  Outputs: Passing targeted tests + confidence in cross-surface flow│
└─────────────────────────────────────────────────────────────────────┘
```

**Estimated time with golden path:** ~55 minutes (vs ~65 minutes actual)

---

## Recommendations

### Immediate (This Sprint)

| Action | Effort | Impact |
|--------|--------|--------|
| Add a single documented command snippet for “server agent tests + client workbench tests” in Workbench dev docs | 20-30 min | Removes test-command mismatch friction |
| Add a tiny utility for steerage confirmation state (marker + explicit confirmation) instead of regex-only matching | 45-60 min | Improves predictability across turn variants |

### Near-Term (Next 2 Sprints)

| Action | Effort | Impact |
|--------|--------|--------|
| Add integration test for multi-turn sequence: `steerage -> user confirm -> proposeWorkflow tool call` | 1-2 hrs | Prevents regressions in HITL checkpoint flow |
| Add UI legend/tooltip for node validation states (`ghost`, `warning`) | 1-2 hrs | Improves explainability of preflight signals |

### Strategic (Roadmap)

| Action | Effort | Impact |
|--------|--------|--------|
| Add diagnostics endpoint for recipe selection rationale (top candidates + scores) | 0.5-1 day | Makes recipe-first behavior auditable and tunable |
| Persist and reuse recipe outcome weights from telemetry in a deterministic local scoring module | 1-2 days | Enables M5 feedback loop with reproducible behavior |

---

## Metrics

| Metric | Value | Target | Notes |
|--------|-------|--------|-------|
| Tool calls | ~28 | <35 | Includes read/edit/test/validation cycles |
| Clarifying questions | 0 | 0-1 | Assignment was explicit |
| Artifacts produced | 13 files touched/added | 8-15 | Spanned prompt/service/UI/test boundaries |
| User round-trips | 0 | 0-1 | Completed in single pass |
| Time to first passing targeted tests | ~25 min | <30 min | After initial implementation pass |
| Total session time | ~65 min | <75 min | Included full client workbench target run |

---

## Key Takeaway

> **Deterministic modules plus scoped test loops let multi-milestone Workbench behavior ship quickly without sacrificing auditability or UX clarity.**

---

## Plan Alignment (Mandatory)

- Plan drift observed:
  - `m3-partial-diff-updates` already had node-level diff primitives in place; implementation needed to focus on partial merge behavior at draft acceptance boundary.
  - `m1-background-preflight` preflight API existed; missing piece was progressive invocation + node visualization propagation.
- Proposed plan update(s) to apply next time:
  - Add explicit note in Milestone 3 that existing diff infra is baseline and the required change is acceptance-time merge semantics.
  - Add explicit note in Milestone 1 that preflight API exists and task scope is "continuous preflight + UI state mapping."
- New preflight steps to add:
  - Run `pnpm vitest run server/services/openai-agent-service.evals.test.ts` before/after any steerage-intent change.
  - Run `pnpm vitest run --config vitest.client.config.ts client/src/features/workbench/__tests__/draft-mutations.test.ts client/src/features/workbench/__tests__/flow-adapters.test.ts` after draft merge or node status UI changes.

---

## Reflection-to-Action (Mandatory)

1. Is there anything you know now that if you knew when you started you would do differently?  
Yes: start with explicit client test config command up front because server default Vitest include excludes client tests.

2. Any decisions you would change?  
Yes: I would have added the `applyDraftProposal()` helper immediately instead of first treating proposal handling as full replacement.

3. Any of that actionable that you would do now given the opportunity?  
Yes: done in-session by adding deterministic partial merge helper + tests and routing proposal acceptance through it.

### Do Now action implemented + test command used (mini snippet)

```md
**Do Now Action Implemented:** Added `applyDraftProposal()` with deterministic partial-merge logic and wired `workbench-page` to use it for incoming agent proposals.
**Why now:** Prevents repeated full-replacement regressions for small refinement turns and preserves user context on unchanged nodes.
**Files touched:** `packages/apps/console/client/src/features/workbench/draft-mutations.ts`, `packages/apps/console/client/src/pages/workbench-page.tsx`, `packages/apps/console/client/src/features/workbench/__tests__/draft-mutations.test.ts`
**Validation command used:** `pnpm vitest run --config vitest.client.config.ts client/src/features/workbench/__tests__/draft-mutations.test.ts client/src/features/workbench/__tests__/flow-adapters.test.ts`
**Validation result:** Pass (9/9 tests)
```

---

## Improvements / Capabilities That Would Help Next

| Type | Proposal | Effort | Expected Impact |
|------|----------|--------|-----------------|
| Tooling | Add a short script alias for combined Workbench server+client scoped test loop | ~30 min | Reduces command mismatch and cycle time |
| Skill/Docs | Add steerage checkpoint test guidance to `workbench-prompt-patterns` skill notes | ~30 min | Improves consistency in future prompt changes |
| Capability/Generator | Add recipe diagnostics contract + fixture generator for deterministic rank tests | 0.5-1 day | Faster evolution of recipe system with less manual setup |

---

## Follow-Up Actions

- [x] Reviewed `/retrospectives/PATTERNS.md` for existing matches
- [x] Reviewed `/retrospectives/IMPROVEMENTS.md` for existing improvements
- [x] Saved this file to `/retrospectives/sessions/`
- [ ] Update PATTERNS/IMPROVEMENTS entries if this friction recurs in another session
