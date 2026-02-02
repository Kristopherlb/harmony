# Retrospective: Strategic Planner Capability (Phase 2)

**Date:** 2026-02-02  
**Scope:** Phase 2 (node-by-node implementation)

## Progress

- Implemented deterministic Phase 2 nodes with TDD + checkpoints:
  - `parse-plan` (file/content/intent normalization)
  - `inventory-skills` (project/global skills + Nx generators)
  - `evaluate-personas` (5-persona heuristic scaffold)
  - `analyze-gaps` (8-category deterministic gaps)
  - `identify-prework` (gap → pre-work mapping, priority ordering)
  - `define-metrics` (per-persona metrics)

## Learnings

- Locking output shapes early via tests prevents drift when we later introduce LangGraph + prompts.
- Minimal parsing strategies (frontmatter + headings) are sufficient for deterministic pipelines.
- Stable ordering and enum-bounded outputs keep the system auditable and predictable.

## Friction

- Repo-root pathing in tests is easy to off-by-one; keep it explicit and local to the test file.
- Some categories (standards/adrs/configuration) need deeper repo context to assess well; heuristics are intentionally conservative.

## Risks / Drift Watchlist

- Introducing LLM-backed evaluation later could break determinism if we don’t enforce:
  - strict JSON-only outputs matching schemas
  - bounded retries/timeouts
  - stable ordering and canonical IDs for items
- Dependency hygiene remains a risk when introducing LangGraph or other runtime deps in `@golden/capabilities`.

## Opportunities

- Add a dedicated dep-hygiene guard test (planned as BACKLOG-004 in the plan).
- When Phase 3 prompts land, add contract tests that validate:
  - `aiHints.exampleInput/exampleOutput` round-trip against schemas
  - prompt outputs conform exactly to schemas (JSON only).

## Next Steps

- Phase 3: introduce prompts and LangGraph assembly while preserving these deterministic shapes.
- Add the capability wrapper and TCS-001 tests once graph wiring exists.

