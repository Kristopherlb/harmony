# Checkpoint: Strategic Planner Capability (Repo Readiness)

**Date:** 2026-02-02  
**Session:** Phase 1.1a (Dependency hygiene)

## Progress

- [x] Verified `@golden/capabilities` source imports are currently limited to workspace packages (`@golden/core`, `@golden/schema-registry`) plus `vitest` in test files.
- [x] Confirmed there are **no** `@langchain/langgraph` imports in `packages/capabilities/` yet, so no direct dependency change is required at this time.

## Learnings

- Keeping `packages/capabilities/package.json` minimal is safe as long as we add direct dependencies *at the moment we introduce new runtime imports* (pnpm strictness).

## Friction

- It’s easy to forget to update the package manifest when adding a new Reasoner dependency (LangGraph) because the first step is often “just add a graph file”.

## Opportunities

- Add a small “dep hygiene” assertion test (or lint rule) later: any non-workspace runtime import in `packages/capabilities/src/` must be present in `packages/capabilities/package.json`.

## Context for Next Session

- Currently working on: Strategic Planner capability (Phase 1.2 schemas/types, TDD-first)
- Next step: Create `schemas.ts` and `types.ts` plus schema-focused unit tests; then add fixture validation tests for `__fixtures__`.

