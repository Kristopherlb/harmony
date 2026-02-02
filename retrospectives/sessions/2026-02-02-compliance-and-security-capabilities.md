# Retrospective: Compliance & Security Capabilities (Phases 7-10)

**Date:** 2026-02-02
**Session Duration:** ~45 minutes
**Artifacts Produced:**
- `packages/capabilities/src/security/tuf-repository.capability.ts` (Real Implementation)
- `packages/blueprints/src/generators/domain-generator.ts` (New Plugin)
- `.agent/skills/pipeline-auditor/SKILL.md` (New Skill)
- Updated `task.md`, `implementation_plan.md`, `walkthrough.md`

---

## What Went Well

### 1. De-mocking Velocity
Successfully replaced mocks for `gittuf`, `model-signing`, `package-analysis`, and `tuf-repository` in rapid succession. The pattern of "implement -> verify -> test" worked well for sequential execution.

### 2. Strategic Feature Implementation
Implemented `Domain Generator` (IMP-006) and `Pipeline Auditor` skill (from backlog) alongside the planned de-mocking work, effectively clearing the backlog.

### 3. Build Verification
Caught and fixed subtle schema and type errors in `capabilities` package by running full builds, ensuring the codebase remains compilable.

---

## What Could Have Been Better

### 1. Build Failure due to RetryPolicy Interface Mismatch
The `retryPolicy` object in multiple capabilities was missing `backoffCoefficient`, causing build failures.
**Impact:** 2 unnecessary tool calls and context switching to diagnose variables.

### 2. Syntax Confusion in Factory Code
Mixed Shell parameter expansion (`${VAR:-default}`) with TypeScript interpolation (`${var}`) in `openbao.capability.ts`, leading to parse errors.
**Impact:** 1 failed build and a fix cycle.

### 3. Schema Defaults vs Factory Logic
Removed `default()` from Zod schemas to fix type inference but forgot to handle `undefined` values in the factory function manually.
**Impact:** Type errors during build requiring another fix cycle.

---

## The Golden Path (If It Existed)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Step 1: Run Pre-Flight Build Check                                 │
│  Outputs: Verify baseline health before editing                     │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 2: Implement & Audit Types                                    │
│  Outputs: Check shared interfaces (RetryPolicy) before use          │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 3: Sequential Implementation & Verification                   │
│  Outputs: Implement one, build, verify. Repeat.                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Estimated time with golden path:** ~35 minutes (vs ~45 minutes actual)

---

## Recommendations

### Immediate (This Sprint)

| Action | Effort | Impact |
|--------|--------|--------|
| [IMP-020] Enforce `retryPolicy` complete shape | Low | Prevent build failures from partial types |
| [IMP-021] Lint rule/check for Shell vs TS string interpolation | Medium | Prevent syntax confusion in factory strings |

### Near-Term (Next 2 Sprints)

| Action | Effort | Impact |
|--------|--------|--------|
| [IMP-022] Expand Domain Generator to full implementation | High | Reduce manual boilerplate for new capabilities |

---

## Metrics

| Metric | Value | Target | Notes |
|--------|-------|--------|-------|
| Tool calls | ~35 | <30 | Build fixes added overhead |
| Artifacts produced | 4 | >2 | High outcome density |
| Build fixes | 3 | 0 | RetryPolicy, OpenBao syntax, Schema defaults |

---

## Key Takeaway

> **Aggressive de-mocking is effective but requires strict type discipline (especially shared interfaces like `RetryPolicy`) to avoid cascading build failures.**

---

## Plan Alignment (Mandatory)

_What should change in the plan so the next run is easier and less error-prone?_

- **Plan update**: Add "Verify Shared Types" step before implementing multiple capabilities that share config.
- **New preflight steps**: Run `pnpm nx build capabilities` *before* starting work to ensure a clean slate.

---

## Follow-Up Actions

- [x] Update `/retrospectives/PATTERNS.md`
- [x] Add recommendations to `/retrospectives/IMPROVEMENTS.md`
