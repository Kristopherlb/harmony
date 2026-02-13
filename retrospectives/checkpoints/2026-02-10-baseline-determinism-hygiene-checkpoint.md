# Checkpoint: Baseline `determinism-hygiene`

**Date:** 2026-02-10  
**Scope:** deterministic discovery regen/sync order + guardrails across capability/blueprint tracks  

## Progress

- [x] Ran deterministic regen+sync (`pnpm tools:regen-sync`) to reconcile discovery artifacts
- [x] Validated tool-catalog tests pass after regeneration
- [x] Resolved a domain taxonomy mismatch caught by tool-catalog generation (demo capabilities)

## Key changes

- Updated discovery artifacts via:
  - `packages/tools/mcp-server/src/manifest/tool-catalog.json` (regenerated)
  - `packages/capabilities/src/registry.ts` + `packages/capabilities/index.ts` (sync generator updates)
- Normalized demo capability `metadata.domain` to match generator expectations:
  - `golden.echo` → `domain: demo`
  - `golden.math_add` → `domain: demo`

## Validation performed

- `pnpm tools:regen-sync` (successful)
- `pnpm -w vitest run packages/tools/mcp-server/src/manifest/tool-catalog.test.ts` (passes)

## Learnings

- The regen pipeline is effectively a determinism “tripwire”: it catches taxonomy drift that unit tests alone may not surface.
- Some capability domains are validated against a canonical mapping (e.g. demo capabilities), not purely inferred from ID strings.

## Friction

- Tool-catalog generation failures can appear late (when running regen), so it’s important to run regen immediately after taxonomy/registry edits.

## Plan alignment

- **Drift**: none; this directly tightens the “deterministic discovery” requirement.
- **Proposed plan updates (copy/paste)**:
  - Add “run `pnpm tools:regen-sync` and ensure tool-catalog tests pass” as a required completion gate for any capability/blueprint metadata changes.

