---
name: classification-semantics-standard
description: Apply CSS-001 to keep classification behavior consistent across capabilities, blueprints, MCP exposure, and certification.
---

## Classification Semantics Standard (CSS-001)

Use this skill when you need to declare, derive, compare, or audit `PUBLIC | INTERNAL | CONFIDENTIAL | RESTRICTED` classification.

### When to Use

- Defining or reviewing `dataClassification` for OCS capabilities
- Defining or reviewing blueprint descriptor `security.classification`
- Implementing RESTRICTED gating behavior for MCP tools (approval required)
- Writing audits/certification checks that reason about classification

### Instructions

1. **Use the CSS-001 lattice** and ordering for all comparisons.
2. **Require explicit declaration** of blueprint classification in descriptors (BDS-001) and capability classification (OCS).
3. **Enforce derivation**: blueprint.classification must be >= max(invoked capability classifications).
4. **Gate RESTRICTED**: RESTRICTED tools must require explicit approval artifacts per AECS-001.

See `references/classification-semantics-standard.md` for the normative specification.

