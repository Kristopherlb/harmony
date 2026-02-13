# Retrospective: Workbench Golden Path M0/M1 Foundations (Assigned To-dos)

**Date:** 2026-02-10  
**Session Duration:** ~95 minutes  
**Artifacts Produced:**
- `docs/workbench/workbench-agent-readiness.md`
- `.cursor/plans/workbench_golden_path_agent_boost_2e0303b3.plan.status.md`
- `docs/workbench/workbench-golden-path-manual-qa.md` (updated)
- `docs/workbench/SPEC-Approval-Context-Enforcement.md`
- `docs/workbench/SPEC-Run-Telemetry-Parity.md`
- `docs/workbench/SPEC-Golden-Path-Recipe-Registry.md`
- `docs/workbench/VALIDATION-MATRIX.md`
- `packages/apps/console/server/audit/approval-log.ts` (updated)
- `packages/apps/console/server/audit/approval-log.test.ts`
- `packages/apps/console/server/routers/workbench-router.ts` (updated)
- `packages/apps/console/server/routes.test.ts` (updated)
- `.cursor/rules/foundation-over-workarounds.mdc`

---

## What Went Well

### 1. Front-loaded foundation work reduced implementation risk
Milestone 0 artifacts (readiness, visibility, QA living guide, and spec pack) were completed before deeper implementation changes, which reduced hidden assumptions and clarified acceptance criteria.

### 2. TDD exposed the right enforcement point
A failing API test proved missing context was accepted incorrectly, then implementation was moved from adapter-only validation to a domain-level invariant in the approval log module.

### 3. User preference was converted into persistent guidance
The preference for root-cause fixes was codified as an always-on Cursor rule, reducing risk of future workaround-driven drift.

---

## What Could Have Been Better

### 1. Initial validation placement was adapter-local
The first pass put approval context validation in the route layer before moving it to the audit module.

**Impact:** Small rework cycle (one extra implementation pass + test rerun).

### 2. Targeted test invocation ergonomics were noisy
The package test command path required correction before executing the intended scoped suite.

**Impact:** Minor time loss and one avoidable failed test command.

### 3. Full suite included unrelated flaky/slow paths
A broad test invocation surfaced an unrelated timeout in another area, which added noise for focused validation.

**Impact:** Added investigation overhead despite no regression in touched scope.

---

## The Golden Path (If It Existed)

_Describe what an ideal workflow would look like for this type of work._

```
┌─────────────────────────────────────────────────────────────────────┐
│  Step 1: Load startup + retro + architecture context                │
│  Outputs: constraints, active patterns, expected standards           │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 2: TDD from core boundary                                     │
│  Outputs: failing tests in domain + adapter layers                  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 3: Implement invariant in shared module                       │
│  Outputs: thin adapters, stable error contract, green targeted tests│
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 4: Update docs/status/qa in same change                       │
│  Outputs: aligned specs, living QA, visible project status          │
└─────────────────────────────────────────────────────────────────────┘
```

**Estimated time with golden path:** ~70 minutes (vs ~95 minutes actual)

---

## Recommendations

### Immediate (This Sprint)

| Action | Effort | Impact |
|--------|--------|--------|
| Add a shared approval context validator contract and reuse in all approval surfaces | 2-4 hours | Prevents future drift and duplicate logic |
| Add a dedicated `test:server:approval` script for fast scoped TDD loops | 30-60 minutes | Reduces command friction and false starts |

### Near-Term (Next 2 Sprints)

| Action | Effort | Impact |
|--------|--------|--------|
| Add API contract snapshots for approval error payloads | 2-3 hours | Stabilizes client/server contract behavior |
| Add architecture guard test for “validation belongs in domain module” | 2-4 hours | Preserves layering and maintainability |

### Strategic (Roadmap)

| Action | Effort | Impact |
|--------|--------|--------|
| Introduce cross-surface approval context schema package (Workbench + Ops Hub + Slack) | 1-2 days | Unified policy enforcement and lower maintenance |

---

## Metrics

| Metric | Value | Target | Notes |
|--------|-------|--------|-------|
| Tool calls | 28 | <35 | Included skill load, preflight reads, edits, tests |
| Clarifying questions | 0 | 0-1 | Requirements were explicit |
| Artifacts produced | 12 | 8+ | Included docs, specs, tests, and rule |
| User round-trips | 2 | <=3 | One alignment request and one retro request |
| Time to first plan | ~8 min | <10 min | Task order was explicit from to-do IDs |
| Total session time | ~95 min | <100 min | Included second pass for foundational hardening |

---

## Key Takeaway

> **Durable progress came from enforcing invariants at the domain boundary and codifying quality expectations as persistent project rules, not from endpoint-local patches.**

---

## Plan Alignment (Mandatory)

_What should change in the plan so the next run is easier and less error-prone?_

- Plan drift observed: implementation began with route-layer validation before being hardened into a shared audit-domain invariant.
- Plan update(s) to apply next time (copy/paste-ready):

```markdown
- In Milestone 1 tasks, add: "Enforce approval context contract in shared approval-log domain module and keep router as adapter-only mapping layer."
- In validation tasks, add: "Require both domain-level and route-level tests for approval contract."
```

- New preflight steps to add:

```markdown
- Before coding contract enforcement, identify the deepest reusable boundary and add failing tests there first.
- Use scoped test commands (or dedicated scripts) to avoid unrelated suite noise during TDD.
```

---

## Improvements / Capabilities That Would Help Next

_What tools/skills/generators/capabilities would have reduced friction or prevented mistakes?_

| Type | Proposal | Effort | Expected Impact |
|------|----------|--------|-----------------|
| Tooling | `test:server:approval` focused script | 30-60 minutes | Faster TDD cycles |
| Skill/Docs | Add “boundary-first validation” note to workbench implementation docs | 1-2 hours | Fewer adapter-local workarounds |
| Capability/Generator | Shared approval contract helper for all surfaces | 1 day | Eliminate duplicated validation logic |

---

## Follow-Up Actions

After completing this retrospective:

- [x] Update `/retrospectives/PATTERNS.md` with recurring pattern changes
- [x] Add recommendations to `/retrospectives/IMPROVEMENTS.md` with IDs
- [x] Save file in `/retrospectives/sessions/`
- [x] Create persistent rule for root-cause-first preference
