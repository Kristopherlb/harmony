# Retrospective: Incident Lifecycle — IMP-030–033 Followthrough

**Date:** 2026-02-02  
**Session Duration:** ~120 minutes  
**Artifacts Produced:**
- `packages/apps/console/shared/schema.ts` (canonical `incidentId` + execution context)
- `packages/apps/console/shared/db-schema.ts` (`events.incident_id`, `workflow_executions` table)
- `packages/apps/console/server/repositories/postgres-action-execution-repository.ts`
- `packages/apps/console/server/repositories/hybrid-action-repository.ts`
- `packages/apps/console/server/composition.ts` (Postgres execution storage wiring)
- `packages/apps/console/server/actions/http/actions-router.ts` (scoped approvals/executions query params + route ordering fix)
- `packages/apps/console/client/src/pages/incidents.tsx` (incident-scoped approvals/executions)
- `packages/apps/console/server/routes.test.ts` (scoped endpoint tests)
- Cursor skills bootstrap:
  - `.cursor/skills-vendored/README.md`
  - `tools/scripts/cursor-skills.mjs`
  - `tools/scripts/cursor-skills.test.mjs`
  - `.github/workflows/ci.yml`

---

## What Went Well

### 1. Sequencing worked (contracts → persistence → endpoints)
Implementing **IMP-032** first (canonical `incidentId` in shared contracts and DB) made **IMP-031** persistence and **IMP-030** scoping straightforward and consistent.

### 2. Architecture guardrails held under change
We added DB-backed storage for executions without violating the Console server’s clean boundaries (no `drizzle/pg/express/zod` runtime imports in domain/application).

### 3. CI/DevEx guardrails became real (IMP-033)
Vendored Cursor skills + bootstrap/verify scripts + CI checks turned “global skill availability” from an assumption into a deterministic guardrail.

---

## What Could Have Been Better

### 1. Express route ordering bug surfaced late
`GET /api/actions/executions` returned 404 because `/:actionId` was registered earlier and shadowed the path.

**Impact:** ~10 minutes debugging + a failed test run.

### 2. “Persistence landing” still lacks a migration story
We added Drizzle schema definitions, repository code, and integration tests (skipped without `DATABASE_URL`), but there’s still no explicit migration step documented for developers running Postgres mode locally.

**Impact:** Risk of “works in tests but not in dev env” if Postgres is enabled without the schema applied.

### 3. Scope phrasing: global timeline vs incident-scoped timeline
The plan called out updating `timeline` views; in practice, **incident detail** needed scoping, while the **global** timeline remains intentionally unscoped.

**Impact:** Minor ambiguity in plan wording; could cause future rework if someone “fixes” the global timeline incorrectly.

---

## The Golden Path (If It Existed)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Step 1: Enable incidentId linking (contract + DB)                   │
│  Outputs: shared schemas + DB columns + propagation rules            │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 2: Turn on Postgres execution store                            │
│  Outputs: workflow_executions schema + repo + composition flag        │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 3: Add incident-scoped read endpoints                           │
│  Outputs: /executions + /approvals scoped query params + UI adoption  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 4: Verify skills/tooling preflight                             │
│  Outputs: vendored skills + verify/install + CI guardrail             │
└─────────────────────────────────────────────────────────────────────┘
```

**Estimated time with golden path:** ~90 minutes (vs ~120 minutes actual)

---

## Recommendations

### Immediate (This Sprint)

| Action | Effort | Impact |
|--------|--------|--------|
| Add an explicit “Express route ordering” check/pattern for routers with `/:id` routes (or lint-style test) | 0.5–1h | Prevents accidental route shadowing regressions |
| Document the Postgres-mode migration prerequisite for Console (`workflow_executions`, `events.incident_id`) | 0.5–1h | Reduces “works in CI, breaks locally” risk |

### Near-Term (Next 2 Sprints)

| Action | Effort | Impact |
|--------|--------|--------|
| Move scoped filtering from HTTP layer to repository queries in Postgres mode | 0.5d | Avoids in-memory filtering and scales with history |
| Add “incident-scoped timeline” endpoint (server-side join) for durable audit views | 1–2d | Makes incident pages fast and correct at scale |

### Strategic (Roadmap)

| Action | Effort | Impact |
|--------|--------|--------|
| Introduce migrations + environment bootstrap for Postgres-backed Console dev mode | 2–4d | Reliable dogfooding of persistence-backed features |

---

## Metrics

| Metric | Value | Target | Notes |
|--------|-------|--------|-------|
| Tool calls | ~25 | <40 | Mostly code edits + tests |
| Clarifying questions | 0 | 0 | Requirements were already decided in plan |
| Artifacts produced | 10+ | 8+ | Contracts + DB + repo + router + CI/devex |
| User round-trips | 0 | 0 | Implemented end-to-end in one pass |
| Total session time | ~120 min | <120 min | Slightly over due to route shadowing debug |

---

## Key Takeaway

> **Make incident linkage and scoping a first-class contract, and everything else (persistence, UI, approvals) becomes simpler and more deterministic.**

---

## Plan Alignment (Mandatory)

### Plan drift observed
- “Update timeline view to use scoped endpoints” was ambiguous: the **incident detail** timeline needed scoping; the **global** timeline remains intentionally unscoped.
- IMP-033 was already present in this branch (vendored skills + bootstrap + CI guardrail); the work was verification and alignment rather than net-new implementation.

### Plan update(s) to apply next time (copy/paste-ready text)

```markdown
#### Route ordering preflight (Express)
- If a router has a `/:id` or `/:actionId` route, ensure all fixed-prefix routes (e.g. `/executions`, `/approvals/*`) are registered first.
- Add a route test that hits a fixed-prefix route (`/executions`) to catch shadowing.

#### Timeline scoping wording
- Clarify that only incident detail views should use incident-scoped approvals/executions endpoints.
- The global timeline should remain unscoped by default.

#### Postgres mode preflight
- If `REPOSITORY_MODE=postgres`, ensure required tables exist: `events.incident_id`, `workflow_executions`.
```

### New preflight steps to add
- `pnpm -w skills:verify:vendored` (CI-safe) and `pnpm -w skills:verify` (developer machines).
- `pnpm -w nx test console` after any router changes (guards route order regressions).

---

## Improvements / Capabilities That Would Help Next

| Type | Proposal | Effort | Expected Impact |
|------|----------|--------|-----------------|
| Tooling | Router route-ordering regression test helper (shared test utility) | 1–2h | Prevents param-route shadowing bugs |
| Tooling | Console Postgres migration/bootstrap docs + script | 0.5d | Makes Postgres mode predictable |
| Capability | DB-backed incident timeline query endpoint (incidentId scoped) | 1–2d | Faster incident views; less client-side joining |

---

## Follow-Up Actions

- [x] Update `/retrospectives/PATTERNS.md` with any recurring patterns
- [x] Update `/retrospectives/IMPROVEMENTS.md` statuses for IMP-030–033

