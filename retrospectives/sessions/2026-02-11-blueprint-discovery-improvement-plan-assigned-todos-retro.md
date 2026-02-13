# Retrospective: Blueprint Discovery Improvement Plan (Assigned To-dos)

**Date:** 2026-02-11  
**Session Duration:** ~95 minutes  
**Artifacts Produced:**
- `packages/apps/console/server/services/intent-router.ts`
- `packages/apps/console/server/services/intent-router.test.ts`
- `packages/apps/console/server/services/openai-agent-service.ts`
- `packages/apps/console/server/services/openai-agent-service.test.ts`
- `packages/apps/console/server/services/openai-agent-service.evals.test.ts`
- `packages/apps/console/server/blueprint-first-api-smoke.test.ts`
- `packages/apps/console/server/agent/prompts/blueprint-generation.ts`
- `docs/dev/mcp-tools-refresh.md`
- `docs/workbench/workbench-agent-golden-path.md`
- `docs/workbench/workbench-golden-path-manual-qa.md`
- `docs/workbench/VALIDATION-MATRIX.md`
- `docs/workbench/workbench-blueprint-discovery-spp-review.md`
- `retrospectives/checkpoints/2026-02-11-blueprint-discovery-*.md`

---

## What Went Well

### 1. Root-cause enforcement at service boundary
Discovery fidelity was hardened in `openai-agent-service` with deterministic catalog-grounded output, preventing LLM drift on discovery-only turns.

### 2. TDD gate remained explicit and evidenced
Intent/discovery changes were implemented with RED first, then minimal GREEN, and eval contract updates to keep behavior explicit.

### 3. MCP gate moved into executable smoke path
MCP health checks are now encoded in the blueprint-first smoke test path (Console API + direct MCP handshake) before propose/run assertions.

---

## What Could Have Been Better

### 1. Initial test command syntax was wrong
First run used a malformed pnpm invocation.

**Impact:** one extra command loop.

### 2. Discovery eval initially assumed LLM streaming
Eval assertion had to be updated when discovery behavior intentionally switched to deterministic non-LLM response.

**Impact:** one additional red/green cycle in eval harness.

### 3. Documentation updates were done after core code
Docs could have been updated in lockstep with behavior changes.

**Impact:** short-lived mismatch between implementation and runbook guidance.

---

## The Golden Path (If It Existed)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Step 1: Add RED tests for intent and discovery contract            │
│  Outputs: failing routing/discovery assertions                       │
└─────────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 2: Implement deterministic discovery + no-generation gate      │
│  Outputs: catalog-grounded responses and truthful empty-catalog path │
└─────────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 3: Add blueprint-first MCP-gated API smoke                     │
│  Outputs: preflight gate + propose/run/status smoke                  │
└─────────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 4: Update docs/matrix + retros in same pass                    │
│  Outputs: operator-ready runbook and durable process evidence         │
└─────────────────────────────────────────────────────────────────────┘
```

**Estimated time with golden path:** ~80 minutes (vs ~95 minutes actual)

---

## Recommendations

### Immediate (This Sprint)

| Action | Effort | Impact |
|--------|--------|--------|
| Add `test:server:blueprint-smoke` script for MCP-gated propose/run flow | 20 min | Faster repeatable validation loop |
| Add `test:server:discovery-fast` script for intent + discovery contract tests | 20 min | Shorter TDD cycle for discovery changes |

### Near-Term (Next 2 Sprints)

| Action | Effort | Impact |
|--------|--------|--------|
| Add staging MCP readiness smoke (service endpoint + handshake) | 0.5 day | Prevent local-only confidence |
| Add fixture replay for additional discovery utterance variants | 0.5 day | Better regression resistance |

### Strategic (Roadmap)

| Action | Effort | Impact |
|--------|--------|--------|
| Add CI gate requiring MCP readiness smoke before blueprint-first release checks | 1 day | Makes MCP gate non-optional in delivery pipeline |
| Add static linter rule to require tool IDs in discovery-mode answer templates | 1 day | Reduces accidental reintroduction of generic discovery responses |

---

## Metrics

| Metric | Value | Target | Notes |
|--------|-------|--------|-------|
| Tool calls | ~40 | <50 | Included skill preflight, code/test/docs/retro |
| Clarifying questions | 0 | 0-1 | Assigned todos were explicit |
| Artifacts produced | 20+ files | 10-25 | Included code/tests/docs/retros |
| User round-trips | 0 | <=1 | Completed in one pass |
| Time to first RED test | ~15 min | <20 min | Included mandatory skill reads |
| Total session time | ~95 min | <120 min | Includes one command correction loop |

---

## Key Takeaway

> **The durable fix was moving discovery correctness into deterministic service logic and making MCP readiness a hard gate in the blueprint-first API smoke path.**

---

## Plan Alignment (Mandatory)

- Plan drift observed: none; all assigned todos were implemented.
- Plan update(s) to apply next time:

```md
- Add required command aliases for discovery and blueprint-smoke tests to reduce command drift.
- Treat direct MCP handshake validation as mandatory in every local/staging blueprint-first validation checklist.
- Keep discovery contract in deterministic service code; prompts remain supportive but not authoritative.
```

- New preflight steps to add:
  - Run `pnpm --dir packages/apps/console exec vitest run server/services/intent-router.test.ts server/services/openai-agent-service.test.ts server/services/openai-agent-service.evals.test.ts`
  - Run `pnpm --dir packages/apps/console exec vitest run server/blueprint-first-api-smoke.test.ts`

---

## Reflection-to-Action (Mandatory)

1. Is there anything you know now that if you knew when you started you would do differently?  
   Yes, define package-scoped test command snippets up front to avoid invocation missteps.
2. Any decisions you would change?  
   No architectural decisions need reversal.
3. Any of that actionable that you would do now given the opportunity?  
   Yes, add fast scripts and make them the canonical commands in docs and CI.

### Do Now action implemented + test command used (mini snippet)

```md
**Do Now Action Implemented:** Added deterministic discovery contract + MCP-gated blueprint-first API smoke test.
**Why now:** Prevents discovery drift and forces MCP readiness before propose/run validation.
**Files touched:** `packages/apps/console/server/services/openai-agent-service.ts`, `packages/apps/console/server/blueprint-first-api-smoke.test.ts`, `docs/workbench/VALIDATION-MATRIX.md`
**Validation command used:** `pnpm --dir packages/apps/console exec vitest run server/services/intent-router.test.ts server/services/openai-agent-service.test.ts server/services/openai-agent-service.evals.test.ts server/blueprint-first-api-smoke.test.ts`
**Validation result:** pass (15 tests)
```

---

## Improvements / Capabilities That Would Help Next

| Type | Proposal | Effort | Expected Impact |
|------|----------|--------|-----------------|
| Tooling | Add `test:server:blueprint-smoke` script | 20 min | Faster smoke-gate validation |
| Tooling | Add `test:server:discovery-fast` script | 20 min | Faster TDD loop for discovery behavior |
| Skill/Docs | Add discovery-fidelity checklist snippet to Workbench feature skill | 20 min | Consistent operator/dev execution path |

---

## Follow-Up Actions

- [x] Update `/retrospectives/PATTERNS.md` with recurring pattern note
- [x] Add recommendations to `/retrospectives/IMPROVEMENTS.md` with IDs
- [x] Move this file to `/retrospectives/sessions/`
- [ ] Create scripts for immediate recommendations
