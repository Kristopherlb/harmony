---
name: capability-discovery-metadata
description: Apply CDM-001 to standardize discovery taxonomy (domain/subdomain/tags) for capabilities and blueprints, and enable deterministic tool catalog generation.
---

# Capability Discovery Metadata (CDM-001)

Use this skill when designing, generating, or validating discovery metadata used by the Console Workbench palette, the Capabilities Catalog page, and MCP tool catalogs.

## When to Use

- Adding or updating an OCS capability’s `metadata` for discoverability
- Adding or updating a blueprint descriptor’s `metadata` for discoverability
- Building generators/CI gates that validate taxonomy deterministically
- Generating the deterministic `tool-catalog.json` artifact

## Instructions

1. Follow the normative requirements in `references/cdm-001.md`.
2. Treat `metadata.id` as canonical (NIS-001) and derive everything deterministically.
3. Prefer generators to populate and validate taxonomy to prevent drift (GSS-001).
4. Keep the catalog deterministic:
   - No timestamps (use a constant)
   - Stable ordering: \(domain, subdomain (undefined last), id\)
   - Stable schema conversion (Zod → JSON Schema) with no `$ref` indirection

## What’s enforced today (CI + generators)

- **Deterministic catalog drift gate**:
  - The committed artifact at `packages/tools/mcp-server/src/manifest/tool-catalog.json` MUST match regenerated output.
  - Fix: run `pnpm -w nx run mcp-server:generate-tool-catalog` and commit the result.

- **Strict source-level taxonomy gate (with temporary allowlist)**:
  - Capabilities MUST declare `metadata.domain` (and tags MUST include that domain), unless the ID is in:
    - `policies/cdm-001-domain-allowlist.json`
  - Blueprints MUST declare `descriptor.metadata.domain/subdomain/tags` (this repo’s built-in descriptors have been migrated).

## How to regenerate the deterministic catalog

Run:

```bash
pnpm -w nx run mcp-server:generate-tool-catalog
```

This writes:

- `packages/tools/mcp-server/src/manifest/tool-catalog.json`

## How to migrate off the allowlist (recommended workflow)

For each allowlisted capability:

1. Add `metadata.domain` and (optionally) `metadata.subdomain` in the capability definition.
2. Ensure `metadata.tags` includes `metadata.domain`.
3. Remove the capability ID from `policies/cdm-001-domain-allowlist.json`.
4. Regenerate the tool catalog:
   - `pnpm -w nx run mcp-server:generate-tool-catalog`
5. Run tests (at minimum):
   - `pnpm -w vitest run packages/tools/mcp-server/src/manifest/cdm-001-strict-domain.test.ts`

## Common taxonomy conventions (project-specific)

- **Capabilities**:
  - ID shape: `golden.<domain>[.<subdomain>].<name>`
  - `metadata.domain` MUST equal the segment after `golden.`
- **Blueprints**:
  - ID shape examples: `workflows.<name>`, `blueprints.<area>.<name>`
  - `metadata.domain` is the first segment (`workflows`, `blueprints`)


