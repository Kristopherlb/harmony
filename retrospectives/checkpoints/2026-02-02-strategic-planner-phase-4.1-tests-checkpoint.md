# Checkpoint: Strategic Planner Capability (Phase 4.1 - TCS-001 Tests)

**Date:** 2026-02-02  
**Session:** Phase 4.1 (contract + integration tests)

## Progress

- [x] Added TCS-001 contract tests for the Strategic Planner capability:
  - `packages/capabilities/src/reasoners/strategic-planner.capability.test.ts`
- [x] Test coverage includes:
  - OCS metadata/security baseline checks
  - `aiHints.exampleInput/exampleOutput` round-trip validation against schemas
  - PES-001 prompt structure validation (required tags present)
  - In-process integration run using the LangGraph graph with committed fixtures
  - Factory wiring checks (Dagger container definition mocked)

## Learnings

- Keeping global skill discovery out of tests (by overriding `globalSkillsDir`) prevents nondeterministic results across developer machines and CI.
- Contract tests provide a stable “shape lock” that protects downstream tooling (MCP/tool catalog generation) from accidental drift.

## Friction

- Import paths inside `src/reasoners/*` tests are easy to misreference; keep paths local (same directory) unless there’s a strong reason.

## Opportunities

- Add a deterministic dogfood test that evaluates the planner plan itself (`.cursor/plans/...`) and validates output schema and key invariants.

## Context for Next Session

- Next step: Phase 4.2 registry export via sync generator + feature flag wiring.

