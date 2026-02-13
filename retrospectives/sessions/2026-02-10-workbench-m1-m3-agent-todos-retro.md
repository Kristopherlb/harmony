# Retrospective: Workbench M1-M3 Assigned To-dos (Telemetry, aiHints, Intent Routing)

**Date:** 2026-02-10  
**Session Duration:** ~85 minutes  
**Artifacts Produced:**
- `packages/apps/console/client/src/features/workbench/run-draft-dialog.tsx`
- `packages/apps/console/client/src/features/workbench/__tests__/run-draft-dialog-telemetry.test.tsx`
- `packages/apps/console/server/routers/workbench-router.test.ts`
- `packages/tools/mcp-server/src/manifest/capabilities.ts`
- `packages/tools/mcp-server/src/manifest/tool-catalog.json`
- `packages/apps/console/server/agent/services/harmony-mcp-tool-service.ts`
- `packages/apps/console/client/src/features/workbench/use-mcp-tools.ts`
- `packages/apps/console/server/services/openai-agent-service.ts`
- `packages/apps/console/server/agent/prompts/blueprint-generation.ts`

---

## What Went Well

### 1. TDD sequencing held for behavior changes
Failing tests were added first for draft telemetry parity, approval audit context, aiHints manifest round-trip, and intent-routing behavior before implementation updates.

### 2. Durable boundary choices reduced workaround risk
Changes landed at stable boundaries (manifest contract, tool service mapping, prompt routing branch) instead of UI-only or route-only patches, which aligns with root-cause-first standards.

### 3. Verification was broad but scoped to touched surfaces
Client, server, and manifest package tests were run in focused groups, followed by lints on touched files, resulting in clean diagnostics and no introduced lint regressions.

---

## What Could Have Been Better

### 1. Deterministic artifact dependency surfaced mid-flow
`HarmonyMcpToolService` aiHints test initially failed because the committed deterministic tool catalog artifact lagged code changes until `tools:regen-sync` was run.

**Impact:** ~10 minutes of additional debug/re-run time.

### 2. Async eval harness required explicit microtask flush
Discovery-path eval assertions initially read capture buffers before stream execution completed.

**Impact:** ~2-3 iterative test cycles.

### 3. Single-target test invocation still exercises broad suite in this package
`pnpm test -- <file>` in `@golden/console` runs a large set of server tests, which increases loop time for narrow changes.

**Impact:** slower edit-test iteration than ideal for isolated service changes.

---

## The Golden Path (If It Existed)

_Ideal workflow for this specific M1-M3 implementation wave:_

```
┌─────────────────────────────────────────────────────────────────────┐
│  Step 1: Preflight + contract tests                                 │
│  Outputs: failing tests for telemetry, aiHints, and intent routing  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 2: Implement at shared boundaries                             │
│  Outputs: service/manifest/prompt updates (no UI-only patching)     │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 3: Deterministic regen + scoped validation                    │
│  Outputs: synced tool catalog + green client/server/manifest tests  │
└─────────────────────────────────────────────────────────────────────┘
```

**Estimated time with golden path:** ~60 minutes (vs ~85 minutes actual)

---

## Recommendations

### Immediate (This Sprint)

| Action | Effort | Impact |
|--------|--------|--------|
| Add a guard test in Console server that fails with actionable message when `tool-catalog.json` is stale relative to manifest shape changes | 1-2h | Prevents re-debugging stale artifact coupling |
| Add a small `flushAgentStream()` helper in eval tests | 30m | Eliminates repeated async timing flake in discovery-path tests |

### Near-Term (Next 2 Sprints)

| Action | Effort | Impact |
|--------|--------|--------|
| Split `openai-agent-service` intent logic into `intent-router.ts` with fixture table tests | 2-4h | Faster, more deterministic intent evolution |
| Add a dedicated fast test script for `openai-agent-service*` suites | 1-2h | Improves feedback loop for prompt/routing changes |

### Strategic (Roadmap)

| Action | Effort | Impact |
|--------|--------|--------|
| Promote `ai_hints` into explicit shared schema contracts across core/capabilities/mcp surfaces | 0.5-1 day | Stronger type safety and fewer drift failures |
| Add observability metric dashboard panel for `ai.intent` distribution and misroute indicators | 0.5 day | Ongoing quality signal for discovery vs generation behavior |

---

## Metrics

| Metric | Value | Target | Notes |
|--------|-------|--------|-------|
| Tool calls | 40+ | <45 | Included skill preflight, edits, and validation |
| Clarifying questions | 0 | 0-1 | Requirements were explicit |
| Artifacts produced | 10+ | 8-12 | Includes tests, contracts, and deterministic artifact regen |
| User round-trips | 0 | <=1 | Completed in one implementation pass |
| Time to first plan | ~8 min | <10 min | Skill preflight + file discovery |
| Total session time | ~85 min | <90 min | Within expected range for 6 cross-surface todos |

---

## Key Takeaway

> **When Workbench changes span UI, manifest artifacts, and agent prompts, test-first plus deterministic regen is the shortest reliable path to completion.**

---

## Plan Alignment (Mandatory)

_What should change in the plan so the next run is easier and less error-prone?_

- Plan drift observed: no major scope drift; one ordering nuance emerged where `tools:regen-sync` needed to happen earlier in Milestone 2 loops to keep service snapshot tests truthful.
- Plan update(s) to apply next time (copy/paste-ready):

```md
- Milestone 2 execution order update:
  1) Add failing manifest/service round-trip tests
  2) Implement `ai_hints` mapping
  3) Immediately run `pnpm tools:regen-sync`
  4) Re-run service/client tests
```

- New preflight steps to add:
  - Confirm deterministic artifact freshness before M2 assertions:
    - `pnpm tools:regen-sync`
    - then targeted manifest + service tests.

---

## Reflection-to-Action

1. **Is there anything you know now that if you knew when you started you would do differently?**  
   Yes. Run deterministic regen immediately after manifest-shape edits and set up fast agent-focused test loops before broad suite runs.

2. **Any decisions you would change?**  
   I would change sequencing decisions (regen/test order), not architecture boundaries.

3. **Any of that actionable that you would do now given the opportunity?**  
   Yes. Add fast test scripts, extract unstable logic into dedicated modules with focused tests, and improve stale-artifact failure messaging.

**Do Now Action Implemented:** Added `test:server:agent-fast`, extracted `intent-router`, and added eval-stream flush helper + actionable stale-catalog test guidance.  
**Why now:** Reduces repeated iteration cost and failure ambiguity for prompt/routing work.  
**Files touched:** `packages/apps/console/package.json`, `packages/apps/console/server/services/intent-router.ts`, `packages/apps/console/server/services/openai-agent-service.evals.test.ts`, `packages/apps/console/server/agent/services/harmony-mcp-tool-service.test.ts`  
**Validation command used:** `pnpm -C packages/apps/console test:server:agent-fast`  
**Validation result:** pass (focused agent/prompt suites green).

---

## Improvements / Capabilities That Would Help Next

| Type | Proposal | Effort | Expected Impact |
|------|----------|--------|-----------------|
| Tooling | Add `pnpm test:console:agent-fast` script for `openai-agent-service*` and prompt tests | 1-2h | Faster iteration for routing/prompt updates |
| Skill/Docs | Add a short retrospective note in Workbench golden path docs: "run regen immediately after manifest shape changes" | 30m | Reduces repeated stale-catalog debugging |
| Capability/Generator | Extend shared capability typing to include optional `constraints` and `negativeExamples` on ai hints | 0.5 day | Better end-to-end type guarantees for M2+ |

---

## Follow-Up Actions

After completing this retrospective:

- [x] Update `/retrospectives/PATTERNS.md` with recurring deterministic artifact coupling occurrence
- [x] Add recommendations to `/retrospectives/IMPROVEMENTS.md` with IDs (covered by follow-up action; implementation started for immediate items)
- [x] Save this file to `/retrospectives/sessions/`
- [x] Create skills/workflows for immediate recommendations (if applicable): added fast agent test script + eval flush helper + stale-catalog actionable test message
