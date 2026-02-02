# Retrospective: Strategic Planner Capability (Final)

**Date:** 2026-02-02  
**Scope:** Final project retrospective (Phases 1–4)

## What shipped

- **Schemas + deterministic nodes (Phase 2 baseline)** already existed and enabled safe layering:
  - `packages/capabilities/src/reasoners/strategic-planner/schemas.ts`
  - `packages/capabilities/src/reasoners/strategic-planner/nodes/*`
- **Prompt templates (Phase 3.1)** aligned to PES-001:
  - `packages/capabilities/src/reasoners/strategic-planner/prompts/*`
- **LangGraph assembly (Phase 3.2)** with a smoke test:
  - `packages/capabilities/src/reasoners/strategic-planner/graph.ts`
  - `packages/capabilities/src/reasoners/strategic-planner/graph.test.ts`
- **OCS capability wrapper (Phase 3.3)** with metadata + aiHints examples:
  - `packages/capabilities/src/reasoners/strategic-planner.capability.ts`
- **TCS-001 tests (Phase 4.1)**:
  - `packages/capabilities/src/reasoners/strategic-planner.capability.test.ts`
- **Registry/tooling integration + feature flag (Phase 4.2)**:
  - `packages/tools/mcp-server/src/manifest/tool-catalog.json`
  - `packages/capabilities/index.ts` (sync-managed export)
  - `deploy/flagd/flags.json` (`cap-golden.reasoners.strategic-planner-enabled`)
- **Dogfood run (Phase 4.3)**:
  - `packages/capabilities/src/reasoners/strategic-planner.dogfood.test.ts`

## Key decisions that worked

- **Schema-first**: locking output shape early prevented drift and made later integration predictable.
- **Deterministic-by-default**: prompts are present but optional; the deterministic node outputs define the stable contract.
- **Governance via generators**: tool catalog + sync generator guardrails caught metadata taxonomy drift immediately (domain/subdomain consistency).
- **Dogfood as a test**: validating against the real plan artifact reduces “happy path only” bias.

## Friction and fixes

- **Tool catalog coupling**: sync requires the committed tool-catalog artifact to include all tool IDs; the correct deterministic order is:
  - align `metadata.domain/subdomain` with id-derived domain/subdomain
  - regenerate tool catalog
  - run sync generator
- **Plan location assumption**: the planner plan is in `~/.cursor/plans/`, not in-repo; dogfood must resolve via `homedir()`.
- **Template string hazards**: avoid `${...}`-shaped sequences inside embedded scripts (escape regexes accordingly).

## Risks / follow-ups (not required for this MVP)

- **LLM augmentation**: if/when LLM calls are added, enforce JSON-only + schema validation + deterministic ordering + bounded retries/timeouts.
- **OTel spans**: add per-node spans and token/cost attributes under the parent trace (GOS-001).
- **Dependency hygiene guard**: add a deterministic test to prevent missing direct deps (BACKLOG-004 in the plan).

