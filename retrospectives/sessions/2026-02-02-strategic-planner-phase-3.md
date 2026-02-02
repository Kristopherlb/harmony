# Retrospective: Strategic Planner Capability (Phase 3)

**Date:** 2026-02-02  
**Scope:** Phase 3 (prompts, graph assembly, capability wrapper)

## Progress

- Added PES-001 prompt templates (schema-aligned, JSON-only, deterministic ordering):
  - `packages/capabilities/src/reasoners/strategic-planner/prompts/persona-evaluation.md`
  - `packages/capabilities/src/reasoners/strategic-planner/prompts/gap-analysis.md`
  - `packages/capabilities/src/reasoners/strategic-planner/prompts/prework-identification.md`
- Assembled LangGraph wiring for Phase 2 nodes:
  - `packages/capabilities/src/reasoners/strategic-planner/graph.ts`
  - Added smoke test: `packages/capabilities/src/reasoners/strategic-planner/graph.test.ts`
- Implemented the OCS capability wrapper with metadata + aiHints:
  - `packages/capabilities/src/reasoners/strategic-planner.capability.ts`
  - Added smoke test: `packages/capabilities/src/reasoners/strategic-planner.capability.smoke.test.ts`
- Captured Phase 3 checkpoints:
  - `retrospectives/checkpoints/2026-02-02-strategic-planner-phase-3.1-prompts-checkpoint.md`
  - `retrospectives/checkpoints/2026-02-02-strategic-planner-phase-3.2-graph-checkpoint.md`
  - `retrospectives/checkpoints/2026-02-02-strategic-planner-phase-3.3-capability-checkpoint.md`

## Learnings

- Locking the schemas in Phase 2 made Phase 3 safe: prompts and orchestration can evolve without changing observable output shapes.
- PES-001 structure + explicit ordering rules reduces ambiguity and improves auditability, even before LLM augmentation is enabled.
- pnpm strictness is a real guardrail: adding `@langchain/langgraph` directly to `@golden/capabilities` avoids “works locally” drift.

## Friction

- Embedded scripts inside TypeScript template strings require careful escaping (notably avoiding `${...}` sequences in regular expressions).
- There are two execution surfaces now:
  - In-process graph (LangGraph) used for deterministic testing and composition
  - Container-executed evaluation logic used for the current OCS “factory returns container” runtime path

## Risks / Drift Watchlist

- If prompt-based augmentation is introduced, we must enforce:
  - JSON-only output, strict schema validation, and stable ordering
  - bounded retries/timeouts and explicit “unknowns” for missing information
- Capability runtime and graph runtime should remain behaviorally aligned. If they diverge, tests must catch it.

## Opportunities

- Add TCS-001 contract tests that validate:
  - `aiHints.exampleInput` parses with input schema
  - `aiHints.exampleOutput` parses with output schema
  - Prompt templates include PES-001 required tags
- Add a deterministic dogfood test that evaluates the planner plan itself and validates the output schema.
- (Backlog) Introduce per-node OTel spans for Reasoner execution (GOS-001).

## Next Steps

- Phase 4.1: add full TCS-001 tests for contract verification + integration behavior.
- Phase 4.2: run sync generator to export/registry-wire the new capability and add the feature flag.
- Phase 4.3: dogfood run on the planner plan and validate output shape deterministically.

