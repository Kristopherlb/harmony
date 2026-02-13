# Retrospective: Workbench M4/M5 Assigned To-dos (Alternative Paths, Scoring, Diagnostics, Feedback)

**Date:** 2026-02-11  
**Session Duration:** ~70 minutes  
**Artifacts Produced:**
- `packages/apps/console/server/services/golden-path-recipes.ts`
- `packages/apps/console/server/services/golden-path-recipes.test.ts`
- `packages/apps/console/server/services/openai-agent-service.ts`
- `packages/apps/console/server/agent/prompts/blueprint-generation.ts`
- `packages/apps/console/server/routers/workbench-router.ts`
- `packages/apps/console/server/routers/workbench-router.test.ts`
- `packages/apps/console/client/src/features/workbench/agent-chat-panel.tsx`
- `packages/apps/console/client/src/features/workbench/__tests__/agent-chat-panel-state-machine.test.tsx`

---

## What Went Well

### 1. Root-cause-first boundary choice
Recommendation quality behavior was implemented at the recipe-selection domain boundary instead of patching in prompts or UI only. This kept ranking, diagnostics, and feedback in one deterministic module.

### 2. TDD-first expansion held under scope growth
Failing tests were added first for selection weighting, diagnostics visibility, alternative trade-offs, router endpoints, and UI feedback wiring, then implementation was incrementally added to satisfy test expectations.

### 3. End-to-end vertical slice delivery
All four assigned to-dos shipped together as one coherent loop: selection -> explainability -> user feedback -> weight updates -> future selections.

---

## What Could Have Been Better

### 1. First client test command targeted wrong Vitest config
Initial command was run from the client package against a server-only test include pattern, causing a false "No test files found."

**Impact:** ~3-5 minutes context switch + rerun.

### 2. Background client test run was broader than intended
`test:client` filtered run still executed a broad suite in this repo setup.

**Impact:** ~25-30 seconds extra runtime and noisier logs than necessary.

### 3. Initial scoring assertion overfit exact winner
One test assumed the weighted recipe must become rank #1; deterministic base-score differences made that brittle.

**Impact:** one red/green loop to rewrite assertion toward weight-effect correctness.

---

## The Golden Path (If It Existed)

_Describe what an ideal workflow would look like for this type of work._

```
┌─────────────────────────────────────────────────────────────────────┐
│  Step 1: Add failing tests for each todo behavior                   │
│  Outputs: red tests grouped by module boundary                      │
└─────────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 2: Implement selection + diagnostics in one module            │
│  Outputs: deterministic scoring primitives + explainability state   │
└─────────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 3: Wire server/router + UI feedback surface                   │
│  Outputs: endpoints + lightweight widget + telemetry hooks          │
└─────────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 4: Run focused test matrix + lints                            │
│  Outputs: green scoped validation and clean diagnostics              │
└─────────────────────────────────────────────────────────────────────┘
```

**Estimated time with golden path:** ~55 minutes (vs ~70 minutes actual)

---

## Recommendations

### Immediate (This Sprint)

| Action | Effort | Impact |
|--------|--------|--------|
| Add a dedicated `test:server:recommendations-fast` script covering recipe scoring + diagnostics + router recommendation endpoints | 20-30 min | Faster and less noisy iteration loop for M4/M5 behavior |
| Add a tiny utility to assert "weighted score effect" without rank-order coupling in recommendation tests | 20 min | Reduces brittle tests when base-score distributions change |

### Near-Term (Next 2 Sprints)

| Action | Effort | Impact |
|--------|--------|--------|
| Persist recommendation weights across restarts (SQLite or Redis in local/dev) | 0.5-1 day | Converts session-only learning into durable local feedback loop |
| Add a compact diagnostics panel in Workbench (primary score, alternatives, rationale) | 0.5 day | Faster debugging for recipe/tool selection behavior |

### Strategic (Roadmap)

| Action | Effort | Impact |
|--------|--------|--------|
| Add per-tool weight learning in addition to per-recipe learning | 1-2 days | Better tool-level recommendation quality under mixed recipe contexts |
| Introduce time-decay weighting policy for historical outcomes/feedback | 1 day | Keeps recommendations adaptive to recent reality |

---

## Metrics

| Metric | Value | Target | Notes |
|--------|-------|--------|-------|
| Tool calls | ~32 | <40 | Included skill loading, edits, tests, lint |
| Clarifying questions | 0 | 0-1 | Scope was explicit and assignable |
| Artifacts produced | 8 files | 6-10 | Included server + client + tests |
| User round-trips | 0 | <=1 | Completed in one execution pass |
| Time to first plan | ~8 min | <10 min | Included mandatory skill and preflight reads |
| Total session time | ~70 min | <90 min | Includes one failed command path and reruns |

---

## Key Takeaway

> **The highest-leverage implementation was centralizing outcome/feedback weighting and explainability in recipe selection, then exposing thin router/UI adapters on top.**

---

## Plan Alignment (Mandatory)

_What should change in the plan so the next run is easier and less error-prone?_

- Plan drift observed: none on scope; all four assigned to-dos landed in this session.
- Plan update(s) to apply next time (copy/paste-ready):

```md
- Add explicit validation guidance for M5: test weighted-effect assertions should verify score component deltas, not mandatory rank inversion when base score dominates.
- Add a standard "recommendation fast test matrix" section with one command for:
  - recipe scoring tests
  - recommendation diagnostics endpoint tests
  - chat panel feedback widget tests
```

- New preflight steps to add:
  - confirm intended Vitest config before first test command (`test:client` vs server default include)
  - run recommendation-focused suites before broader package suites

---

## Reflection-to-Action (Mandatory)

_Answer these directly, then capture what was implemented now._

1. Is there anything you know now that if you knew when you started you would do differently?  
   Yes: start with recommendation-focused server test target immediately and avoid rank-order assumptions in score-effect tests.
2. Any decisions you would change?  
   Yes: avoid first attempting client tests from an incorrect package/config context.
3. Any of that actionable that you would do now given the opportunity?  
   Yes: create a fast recommendation-focused test command and document weighted-score assertion pattern.

### Do Now action implemented + test command used (mini snippet)

```md
**Do Now Action Implemented:** Added deterministic recommendation diagnostics and feedback-weight integration with focused server/client test coverage.
**Why now:** Prevents repeated ambiguity in path selection behavior and makes recommendation choices inspectable.
**Files touched:** `packages/apps/console/server/services/golden-path-recipes.ts`, `packages/apps/console/server/routers/workbench-router.ts`, `packages/apps/console/client/src/features/workbench/agent-chat-panel.tsx`
**Validation command used:** `pnpm vitest run server/services/golden-path-recipes.test.ts server/routers/workbench-router.test.ts server/services/openai-agent-service.test.ts server/services/openai-agent-service.evals.test.ts server/agent/prompts/blueprint-generation.test.ts`
**Validation result:** pass (23/23 tests)
```

---

## Improvements / Capabilities That Would Help Next

_What tools/skills/generators/capabilities would have reduced friction or prevented mistakes?_

| Type | Proposal | Effort | Expected Impact |
|------|----------|--------|-----------------|
| Tooling | Add `test:server:recommendations-fast` script in `@golden/console` | 20-30 min | Faster red/green for M4/M5 recommendation work |
| Skill/Docs | Add recommendation-scoring testing note to retrospective or feature-golden-path guidance | 20 min | Fewer brittle "must be #1" assertions |
| Capability/Generator | Add optional local persistence adapter for recommendation weights | 0.5-1 day | Durable local learning loop across server restarts |

---

## Follow-Up Actions

After completing this retrospective:

- [ ] Update `/retrospectives/PATTERNS.md` with any recurring patterns (none newly recurring this session)
- [x] Add recommendations to `/retrospectives/IMPROVEMENTS.md` with IDs
- [x] Move this file to `/retrospectives/sessions/`
- [ ] Create skills/workflows for immediate recommendations (if applicable)
