---
name: naming-and-identity-standard
description: Apply NIS-001 to standardize canonical IDs, derived names/paths, registry keys, and MCP tool names.
---

## Naming & Identity Standard (NIS-001)

Use this skill when defining IDs, reconciling identity surfaces, or building audits/generators that must stay deterministic.

### When to Use

- Creating new OCS capabilities or WCS blueprints
- Updating registries or MCP manifest generation rules
- Designing or auditing ID format rules, reserved namespaces, or legacy migrations

### Instructions

1. **Canonicalize**: treat `metadata.id` as canonical; registries and MCP tool names must equal it.
2. **Derive deterministically**: define and apply a single transform from canonical ID → file paths/export symbols.
3. **Enforce uniqueness**: ensure IDs are globally unique across capabilities + blueprints + agents.
4. **Enforce format**: enforce lowercase dotted IDs; block new underscores; allow legacy underscores only via allowlist + migration plan.

See `references/naming-and-identity-standard.md` for the normative specification.

