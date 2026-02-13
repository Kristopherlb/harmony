---
# Retrospective: Workbench Followthrough (Tier-0 E2E + Account + Workflows + Costs)

**Date:** 2026-02-09  
**Session Duration:** n/a (implementation completed outside this retrospective)  
**Artifacts Produced:**
- `playwright.config.ts` + `packages/apps/console/e2e/workbench-tier0.spec.ts` (Tier-0 deterministic E2E foundation)
- `/api/chat` fixture mode via `HARMONY_CHAT_FIXTURE` (deterministic drafting for E2E + evals)
- `packages/apps/console/client/src/pages/account-page.tsx` + `packages/apps/console/client/src/features/account/use-account-preferences.ts` (Account route + local preferences persistence)
- `packages/apps/console/client/src/pages/workflows.tsx` (real workflow list/detail UI wired to `/api/workflows/*` + cancel)
- `packages/apps/console/client/src/pages/service-catalog.tsx` (Service detail + dependency/dependent graph + drill-down links)
- `packages/apps/console/client/src/features/workbench/use-mcp-tools.ts` + `packages/apps/console/client/src/features/workbench/node-info-sheet.tsx` (tool exploration metadata + correct exploration affordances)
- `packages/apps/console/client/src/features/workbench/agent-chat-panel.tsx` + `packages/apps/console/client/src/pages/account-page.tsx` (budget/cost UX + `budgetKeyOverride` support via Account preferences)
- `packages/apps/console/vitest.evals.config.ts` + `pnpm -C packages/apps/console test:evals` harness (fixture-driven agent evals)

---

## What Went Well

### 1. Deterministic foundations unblocked meaningful E2E coverage
Adding a Tier-0 Playwright harness plus stable `data-testid` selectors and a fixture-driven `/api/chat` mode made “chat → draft → UI state” tests predictable and repeatable.

### 2. Product surface area became navigable (Account / Workflows / Service detail)
Replacing placeholders with real list/detail pages (and drill-down links) tightened the Workbench’s day-to-day usability and created a clearer “operator workflow” through the Console.

### 3. Cost and budget signals were brought into the core loop
Threading budget keys through Workbench chat and surfacing spend (USD + tokens) reduced “invisible cost” risk and made budgets a first-class constraint rather than an afterthought.

### 4. Metadata-driven affordances prevented UI drift
Capturing exploration metadata on MCP tool snapshots and using it to render the correct exploration buttons in `NodeInfoSheet` kept UI behavior aligned with tool capabilities.

---

## What Could Have Been Better

### 1. Preferences are still local-only (identity + portability gap)
Account preferences (e.g., budget keys) are currently persisted locally; this doesn’t compose with multi-device usage or any authenticated “current user” identity source.

**Impact:** Increased follow-on work to make budgets/prefs durable and safely shared.

### 2. Exploration metadata is single-valued (future extension friction)
Tools can have more than one “explorer” (e.g., OpenAPI + GraphQL). Current modeling supports exactly one `kind`, which will force a schema/API migration when multi-explorer tools appear.

**Impact:** Avoidable refactors once a tool gains additional exploration surfaces.

### 3. E2E is present but not yet a CI contract
The Playwright harness exists, but CI does not enforce Tier-0 E2E as a required gate.

**Impact:** Regressions can slip until manual runs catch them.

### 4. Budget UX is reactive (post-submit) vs predictive (pre-submit)
Costs are visible after the fact; the Workbench does not yet estimate the expected cost of a run before submit using `costFactor` + planned token budget.

**Impact:** Users can exceed budgets unintentionally or only notice spend after execution.

---

## The Golden Path (If It Existed)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Step 1: Add/adjust UI feature                                      │
│  Outputs: stable data-testid selectors + unit tests                 │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 2: Add deterministic fixture coverage                         │
│  Outputs: /api fixture(s) + Tier-0 Playwright spec updates          │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 3: Enforce as a gate                                          │
│  Outputs: CI job runs Tier-0 E2E + uploads trace on failure         │
└─────────────────────────────────────────────────────────────────────┘
```

**Estimated time with golden path:** n/a (depends on feature), but with dramatically lower “did this break the happy path?” uncertainty.

---

## Recommendations

### Immediate (This Sprint)

| Action | Effort | Impact |
|--------|--------|--------|
| Add a server-backed Account preferences API + authenticated “current user” identity source for budget keys | ~0.5–2d | Makes budgets/prefs portable + safe |
| Add a CI job that runs Tier-0 Playwright E2E (fixture mode) as a required gate | ~0.5d | Prevents regressions in core Workbench flows |

### Near-Term (Next 2 Sprints)

| Action | Effort | Impact |
|--------|--------|--------|
| Extend exploration metadata to support multiple explorers per tool and show connection health from `/api/integrations/status` | ~0.5–1d | Avoids schema churn; improves operator trust |
| Add per-run “cost estimate” UX using tool `costFactor` + planned token budget before submit | ~0.5–1d | Budget-aware execution; fewer surprises |

### Strategic (Roadmap)

| Action | Effort | Impact |
|--------|--------|--------|
| Unify fixture-driven evals and Tier-0 E2E around a shared deterministic scenario catalog | ~1–2d | Reuse fixtures across UI + agent regression testing |

---

## Metrics

| Metric | Value | Target | Notes |
|--------|-------|--------|------|
| Tool calls | n/a | n/a | Work completed outside this retro |
| Clarifying questions | low | low | Scope was a followthrough bundle |
| Artifacts produced | 8 areas | 8 | E2E, fixtures, account, workflows, service detail, metadata, costs, evals |
| User round-trips | low | low | Bundled changes landed without plan edits |

---

## Key Takeaway

> **Deterministic fixtures + stable selectors turn “UI followthrough” from brittle to routine — and they enable budgets, evals, and metadata to stay trustworthy as the surface expands.**

---

## Plan Alignment (Mandatory)

**Plan drift observed:** The following requirements were implemented without updating the plan artifact:
1) deterministic Playwright Tier‑0 Workbench E2E + stable selectors + `/api/chat` fixture mode  
2) `/account` route + Account UI + local persistence for saved items/budget key + integrations status display  
3) real `/workflows` list/detail UI wired to `/api/workflows` endpoints with cancel + tests  
4) `ServiceDetailPage` wired to `/api/services/:id` with dependency graph + drill-down links and URL query-prefill  
5) capability exploration metadata (OpenAPI/GraphQL/none + connectionType) surfaced via MCP tool catalog and consumed by `NodeInfoSheet`  
6) Workbench chat multi-turn UX (status pill + reset) plus fixture-driven eval harness  
7) cost/budget controls + reporting in Workbench + Account using server-side cost snapshots and `tool.costFactor`

**Proposed plan update(s) (copy/paste-ready):**
- Add a follow-on phase: “Account preferences persistence + identity”
  - Implement `GET/PUT /api/account/preferences` (server-backed; replaces localStorage)
  - Define “current user” identity source for budget keys (auth integration)
- Add a follow-on phase: “Budget predictability”
  - Pre-submit cost estimate (planned tokens + tool `costFactor`)
- Add a follow-on phase: “Exploration + integrations health”
  - Multi-explorer metadata (`explorations[]`) + connection health surfaced in tool UI
- Add a CI gate: `pnpm e2e` Tier-0 required on PRs

---

## Improvements / Capabilities That Would Help Next

| Type | Proposal | Effort | Expected Impact |
|------|----------|--------|-----------------|
| Tooling | CI Tier-0 E2E gate with traces on failure | ~0.5d | Keeps happy path stable |
| API | Server-backed Account preferences + identity | ~0.5–2d | Durable budgets/prefs; multi-device safe |
| UX | Pre-submit cost estimate | ~0.5–1d | Predictable spend + budget guardrails |
| Schema | Multi-explorer metadata + health | ~0.5–1d | Extensible exploration + trust signals |

---

## Follow-Up Actions

- [ ] Update `retrospectives/PATTERNS.md` if any recurring patterns were resolved/created
- [ ] Add recommendations to `retrospectives/IMPROVEMENTS.md` with IDs
