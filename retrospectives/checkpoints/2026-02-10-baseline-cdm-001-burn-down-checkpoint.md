# Checkpoint: Baseline `cdm-001-burn-down`

**Date:** 2026-02-10  
**Scope:** remove CDM-001 domain allowlist by migrating capabilities to explicit `metadata.domain` + tag hygiene  

## Progress

- [x] Added `metadata.domain` to all previously allowlisted capabilities
- [x] Updated tags to include the declared domain where missing (e.g. `connectors`, `utilities`, `commanders`)
- [x] Reduced `policies/cdm-001-domain-allowlist.json` capabilities list to `[]`

## Validation performed

- **Contract/tests**:
  - `pnpm -w vitest run packages/tools/mcp-server/src/manifest/cdm-001-strict-domain.test.ts` (now passes with empty allowlist)

## Learnings

- Many capabilities already had the correct domain token in tags; the main gap was missing `metadata.domain`.
- A few categories required tag normalization (notably `golden.connectors.*`, `golden.commanders.*`, and `golden.utilities.encoding`).

## Friction

- Domain taxonomy is strict and requires both declaration + tag membership; missing either breaks deterministic discovery gates.

## Plan alignment

- **Drift**: none (this matches the plan’s intent to measurably shrink the allowlist).
- **Proposed plan updates (copy/paste)**:
  - Add “CDM-001 gate must pass with empty allowlist” as the end condition of the burn-down milestone.

