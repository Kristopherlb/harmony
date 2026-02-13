# Retrospective: Baseline Release/Deploy Roadmap (9 assigned todos)

**Date:** 2026-02-10  
**Session Duration:** ~180 minutes  
**Artifacts Produced:**
- Runtime-true release/deploy harness scripts and runbooks
- OpenBao least-priv AppRole auth support across Console ingress + worker secret broker
- CDM-001 metadata migration (allowlist burn-down to empty)
- Deterministic discovery regen/sync updates (`tool-catalog.json`, registries/exports)
- Console interop guardrails (`console:lint-interop`, codemod, check script)
- Checkpoints:
  - `retrospectives/checkpoints/2026-02-10-baseline-openbao-least-priv-checkpoint.md`
  - `retrospectives/checkpoints/2026-02-10-baseline-cdm-001-burn-down-checkpoint.md`
  - `retrospectives/checkpoints/2026-02-10-baseline-determinism-hygiene-checkpoint.md`
  - `retrospectives/checkpoints/2026-02-10-baseline-devex-interop-guardrails-checkpoint.md`

---

## What Went Well

### 1. Deterministic TDD loop for high-risk changes
Behavior-first tests caught auth and discovery issues early (AppRole token handling and metadata/domain mismatches), preventing silent drift in production-critical paths.

### 2. Runtime-true orientation stayed intact
Work prioritized end-to-end flow integrity (webhook -> Temporal -> capability execution, OpenBao late binding, regen/sync artifacts), aligning with Runtime Tetrad boundaries.

### 3. Guardrails were turned into repeatable tooling
Instead of ad-hoc fixes, changes landed as reusable checks and scripts (`tools:regen-sync`, `console:lint-interop`, codemod/checker pair), reducing repeated manual diagnosis.

---

## What Could Have Been Better

### 1. Cross-surface secret auth logic was duplicated before this pass
OpenBao read logic existed in both Console webhook ingress and worker secret broker with token-first assumptions.

**Impact:** Added implementation overhead and risk of behavior divergence; required touching multiple files for one policy change.

### 2. Domain taxonomy mismatches surfaced late at regen time
A mismatch (`metadata.domain` vs expected discovery taxonomy) only failed during tool-catalog generation.

**Impact:** Extra edit/run cycles and delayed feedback after broad metadata migration.

### 3. Broad lint targets are noisy for focused guardrail tasks
Running full Console lint/check surfaced many unrelated baseline TS/ESLint issues.

**Impact:** Signal dilution; needed a narrow interop-specific target to keep execution actionable.

---

## The Golden Path (If It Existed)

_Ideal workflow for cross-package release/deploy hardening + standards compliance._

```
┌─────────────────────────────────────────────────────────────────────┐
│  Step 1: Preflight guardrail bundle                                 │
│  Outputs: baseline health (tests, regen/sync, policy checks)        │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 2: TDD by concern (auth, metadata, determinism, interop)      │
│  Outputs: failing tests + scoped implementation deltas               │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 3: Regenerate deterministic artifacts immediately              │
│  Outputs: synced registries/exports/catalog + passing strict gates   │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 4: Emit runbook + checkpoint after each milestone              │
│  Outputs: reproducible ops docs + resumable session context          │
└─────────────────────────────────────────────────────────────────────┘
```

**Estimated time with golden path:** ~130 minutes (vs ~180 minutes actual)

---

## Recommendations

### Immediate (This Sprint)

| Action | Effort | Impact |
|--------|--------|--------|
| Add CI gate for `pnpm nx run console:lint-interop` | ~30 min | Prevents ESM default-import regressions in Console server |
| Extract shared OpenBao auth/token helper used by Console + worker | ~2-3 hours | Removes duplicated auth logic and reduces drift risk |

### Near-Term (Next 2 Sprints)

| Action | Effort | Impact |
|--------|--------|--------|
| Add an explicit metadata taxonomy validator test for capability IDs/domains before tool-catalog generation | ~2 hours | Earlier failure mode than late regen errors |
| Add staging smoke job that validates AppRole auth against real OpenBao role/policy | ~0.5 day | Confirms least-priv path beyond unit tests |

### Strategic (Roadmap)

| Action | Effort | Impact |
|--------|--------|--------|
| Build a single “release/deploy certification” Nx target chaining strict domain, regen/sync, interop, and runtime smoke | ~1-2 days | Standardized go/no-go gate for roadmap work |
| Generate policy/app-role scaffolding for ISS-001 from secretRefs used by workflows | ~2-3 days | Faster secure environment setup, fewer manual mistakes |

---

## Metrics

| Metric | Value | Target | Notes |
|--------|-------|--------|-------|
| Tool calls | ~120 | <140 | High due to cross-package updates + verification |
| Clarifying questions | 0 | 0-2 | Requirements were explicit |
| Artifacts produced | 10+ | 8+ | Runbooks, scripts, tests, checkpoints, guardrails |
| User round-trips | 2 | <=3 | Continue + final retro confirmation |
| Time to first plan | ~2 min | <5 min | Immediate execution after context load |
| Total session time | ~180 min | <210 min | Included all 9 todos + per-todo checkpoints |

---

## Key Takeaway

> **Cross-package roadmap execution is most reliable when every standards change is paired with immediate deterministic regeneration and a narrow, purpose-built guardrail.**

---

## Plan Alignment (Mandatory)

- Plan drift observed: “execute a real staging run” tasks depend on external staging prerequisites (OpenBao role/policy/secret provisioning) not always explicitly gated in-step.
- Plan update(s) to apply next time:
  - Add a mandatory “Environment Ready” gate before any “real staging run” checkbox:
    - OpenBao AppRole issued
    - least-priv policy attached
    - required secret paths populated
    - health endpoints validated
  - Add a mandatory “Determinism Gate” after metadata/registry edits:
    - `pnpm tools:regen-sync`
    - strict domain test
    - tool-catalog test
- New preflight steps to add:
  - `pnpm nx run console:lint-interop`
  - `pnpm -w vitest run packages/tools/mcp-server/src/manifest/cdm-001-strict-domain.test.ts`

---

## Improvements / Capabilities That Would Help Next

| Type | Proposal | Effort | Expected Impact |
|------|----------|--------|-----------------|
| Tooling | CI wire-up for `console:lint-interop` | ~30 min | Catch interop regressions pre-merge |
| Capability/Tooling | Shared OpenBao auth client helper (token + AppRole + cache) | ~2-3 hours | Single secure implementation path across services |
| Skill/Docs | Add ISS-001 “staging prerequisite checklist” snippet to release/deploy runbooks | ~1 hour | Fewer blocked “real run” steps |

---

## Follow-Up Actions

After completing this retrospective:

- [x] Update `/retrospectives/PATTERNS.md` with recurring patterns observed this run
- [x] Add recommendations to `/retrospectives/IMPROVEMENTS.md` with IDs
- [x] Save this file in `/retrospectives/sessions/`
- [ ] Create shared OpenBao auth helper (if prioritized)

