# Retrospective: Workbench Golden Path (E2E + Account + Workflows + Service Detail + Evals + Cost UX)

**Date:** 2026-02-02  
**Session Duration:** ~3–5 hours (multi-iteration, test-driven)  
**Artifacts Produced:**
- Playwright harness + Tier-0 spec (`playwright.config.ts`, `packages/apps/console/e2e/workbench-tier0.spec.ts`)
- Deterministic chat fixture mode (`packages/apps/console/server/routers/chat-router.ts` + fixture test)
- `/account` page + preferences hook + tests
- `/workflows` list/detail UI + tests
- `ServiceDetailPage` + tests + drill-down query prefills
- Capability exploration metadata + Workbench `NodeInfoSheet` gating + tests
- Multi-turn chat “state machine” UX + tests
- Eval harness (`packages/apps/console/server/services/openai-agent-service.evals.test.ts` + fixture + `test:evals`)
- Cost UX: `/api/workbench/cost`, budgetKey override plumbing, UI badges in Workbench + Account

---

## What Went Well

### 1. Determinism-first testing unlocked end-to-end confidence
The `/api/chat` fixture mode and Tier‑0 Playwright spec made the Workbench’s chat→draft→canvas path stable and non-flaky, enabling rapid UI iteration without relying on LLM variance.

### 2. TDD sequencing kept scope large but tractable
For Workflows, Service Detail, NodeInfo affordances, and chat UX, writing focused tests first constrained implementation choices and helped avoid “UI looks right but contract wrong” regressions.

### 3. Clear separation of “contract vs runtime” surfaces
We kept deterministic contracts (MCP tool catalog snapshot, Workbench session launcher, chat stream shape) isolated from runtime complexity by:
- dynamic imports in chat router (avoid heavy init during fixture runs)
- a dedicated eval-only Vitest config (avoid full suite coupling)

---

## What Could Have Been Better

### 1. Test suite coupling made “run one test” harder than it should be
Running a single server test pulled in unrelated failing suites (and mock/alias interactions), requiring an eval-only Vitest config to get fast feedback.

**Impact:** ~15–30 minutes of debugging and reruns; higher cognitive load.

### 2. “Clickable row” UI patterns introduced DOM nesting warnings
Using `wouter` `Link` plus inner `<a>` created repeated `validateDOMNesting` warnings (`<a>` inside `<a>`).

**Impact:** No functional break, but noisy output and risk of future a11y/interaction bugs.

### 3. Cost UX surfaced totals, but policy + persistence are still incomplete
We exposed in-memory totals and made budgetKey overridable, but:
- budget policy UI is still mostly “display only”
- preferences persistence is localStorage, not server-backed

**Impact:** Good MVP visibility, but not yet “operator-grade” FinOps.

---

## The Golden Path (If It Existed)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Step 1: Enable deterministic mode for UI + agent                    │
│  Outputs: chat fixture, eval fixture template, Playwright scaffold   │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 2: TDD UI surfaces (route + list/detail)                       │
│  Outputs: page tests + minimal UI wired to stable endpoints          │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 3: Wire “exploration + cost + status” affordances via metadata │
│  Outputs: typed metadata, gated UI, snapshot endpoint, badges        │
└─────────────────────────────────────────────────────────────────────┘
```

**Estimated time with golden path:** ~2–3 hours (vs ~3–5 hours actual)

---

## Recommendations

### Immediate (This Sprint)

| Action | Effort | Impact |
|--------|--------|--------|
| Add a shared `LinkButtonRow` (or update patterns) to avoid nested `<a>` warnings | ~30–60 min | Cleaner test output; fewer subtle interaction bugs |
| Add a dedicated server test target for “workbench/agent” (mirrors client `test:client:workbench`) | ~30–60 min | Faster iteration; fewer unrelated failures |
| Add minimal policy display + validation in cost endpoint response docs (and UI copy) | ~30 min | Less confusion about “tracked vs enforced” |

### Near-Term (Next 2 Sprints)

| Action | Effort | Impact |
|--------|--------|--------|
| Server-backed persistence for Account preferences (saved items + defaultBudgetKey) | ~0.5–1.5 days | Multi-device consistency; fewer localStorage edge cases |
| Cost reporting: add per-run “cost delta” and total window (day/run) surfaced in Workbench | ~0.5–1 day | Better operator confidence; quicker budget triage |

### Strategic (Roadmap)

| Action | Effort | Impact |
|--------|--------|--------|
| Formalize an “Agent Eval Runner” (fixtures + expected tool calls + snapshots) across agent services | ~2–5 days | Durable regression testing of prompts/tools across releases |

---

## Metrics

| Metric | Value | Target | Notes |
|--------|-------|--------|-------|
| Tool calls | ~30–60 | <60 | High because multi-surface + several new tests/configs |
| Clarifying questions | ~0 | 0–2 | Requirements were explicit; tests drove details |
| Artifacts produced | 15+ | 8–12 | Includes new tests, pages, server endpoints, configs |
| User round-trips | Low | Low | Mostly implementation-forward |
| Time to first determinism (fixture+Tier0) | ~early | <60 min | Paid dividends across the rest |

---

## Key Takeaway

> **Deterministic fixtures + small, targeted test runners are the fastest path to shipping multi-surface UX changes without regressions.**

---

## Plan Alignment (Mandatory)

- **Plan drift observed**
  - Several items required “foundation” work not called out explicitly (eval runner config, cost endpoint plumbing, URL-prefill behavior).
  - Some tasks completed with “MVP semantics” (in-memory cost totals; localStorage Account prefs) rather than fully persisted workflows.

- **Plan update(s) to apply next time (copy/paste-ready)**

```markdown
Add a “Determinism Foundation” pre-step for any multi-surface Workbench work:
- Add fixture mode(s) for any probabilistic endpoints (chat/agent)
- Add Playwright Tier-0 spec(s) for the golden path
- Add an eval-only test runner config to avoid full-suite coupling

For cost/budget UX:
- Define whether spend totals are: (a) display-only, (b) enforced, or (c) enforced+audited
- Add an API endpoint contract for cost totals (budgetKey, totals, policy)
```

- **New preflight steps to add**
  - Confirm routing library patterns for row navigation (avoid nested anchors).
  - Confirm test target exists for the slice you’re changing (client/workbench, server/evals).

---

## Improvements / Capabilities That Would Help Next

| Type | Proposal | Effort | Expected Impact |
|------|----------|--------|-----------------|
| Tooling | Add `console:test:server:workbench` and `console:test:server:evals` targets | ~30–60 min | Faster feedback loops, fewer unrelated suite failures |
| Skill/Docs | Add a “Wouter Link patterns” snippet in a UI skill/pattern doc | ~15–30 min | Prevent recurring DOM nesting warnings |
| Capability/Generator | Generate eval fixture + harness boilerplate from a template | ~0.5–1 day | Standardizes agent regression testing |

---

## Follow-Up Actions

- [x] Update `/retrospectives/PATTERNS.md` with any recurring patterns (nested anchors; test coupling)
- [x] Add recommendations to `/retrospectives/IMPROVEMENTS.md` with IDs and statuses
- [x] Save this file to `/retrospectives/sessions/`

