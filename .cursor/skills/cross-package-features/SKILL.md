---
name: cross-package-features
description: Guide for implementing features that span core/blueprints/capabilities/console with deterministic ordering and export/registry hygiene.
---

# Cross-Package Features (CPF-001)

Use this skill when implementing a feature that touches multiple Harmony packages (e.g., `core`, `capabilities`, `blueprints`, `apps/console`).

## When to Use

- Adding a new capability and exposing it to MCP + Console catalog/palette
- Adding or extending workflow/HITL infrastructure and wiring UI + handlers
- Adding a new GoldenContext domain and surfacing it across telemetry + UI
- Any change that requires coordinated exports/barrels across packages

## Implementation Order (recommended)

1. **Types + schemas first**
   - Define stable types/schemas at the lowest layer that owns the contract.
   - Prefer Zod schemas where the boundary is untrusted (OCS/TCS-001).

2. **Core next**
   - Add shared types/logic to `packages/core` (avoid app-specific dependencies).
   - If needed by Temporal workflow bundles, export from the workflow-only entrypoint (`packages/core/src/wcs/workflow.ts`).

3. **Capabilities**
   - Implement the capability in `packages/capabilities/src/...` and register it in `packages/capabilities/src/registry.ts` (deterministic, by `metadata.id`).
   - Ensure NIS-001 + CDM-001 metadata is complete: `metadata.id`, `metadata.domain`, `metadata.tags`.

4. **Blueprint activities / orchestration**
   - Add/extend blueprint activities in `packages/blueprints/src/activities/...` (WCS-001).
   - Prefer driving behavior through capabilities rather than adding bespoke side-effect code.

5. **Server integration handlers**
   - Add HTTP handlers under `packages/apps/console/server/...` (e.g., Slack interactive callbacks).
   - Keep handlers thin: verify → parse → call workflow/capability → map response.

6. **Client UI**
   - Add pages/components last so they can rely on stable APIs and schemas.
   - Ensure discovery metadata is surfaced consistently (`domain/subdomain/tags`).

## Export & Registry Hygiene

- Prefer updating existing barrels rather than creating new ones:
  - `packages/core/src/index.ts` (Node-safe core exports)
  - `packages/core/src/wcs/workflow.ts` (workflow-bundle-safe exports)
- Registry keys MUST equal canonical IDs (NIS-001).
- Ordering MUST be stable (sort by `metadata.id`) to keep catalogs deterministic (CDM-001).

## Test Strategy (TDD-aligned)

- Unit tests at the lowest layer that owns behavior
- Contract tests for capabilities (TCS-001): schemas vs `aiHints.exampleInput/exampleOutput`
- Integration tests at package boundaries (HTTP handler, workflow gate) only after unit/contract coverage exists

## References

- `references/cross-package-features.md`
- `packages/core/src/index.ts`
- `packages/core/src/wcs/workflow.ts`
- `packages/capabilities/src/registry.ts`

