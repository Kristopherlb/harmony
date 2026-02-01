---
name: pattern-catalog-capabilities
description: Repeatable capability pattern baselines (connector/transformer/commander/guardian/reasoner) including required metadata, schemas, security posture, and tests.
---

## Capability Pattern Catalog (CPC-001)

Use this skill to pick the right capability pattern and apply a consistent baseline (schemas, security, operations, tests) so generated capabilities don’t drift.

### When to Use

- Creating a new capability and deciding between connector/transformer/commander/etc.
- Auditing a capability for “pattern baseline” compliance
- Building generators/templates that differ by pattern

### Instructions

1. **Classify the capability** into exactly one primary pattern (connector/transformer/commander/guardian/reasoner).
2. **Apply the pattern baseline** from `references/pattern-catalog-capabilities.md`.
3. **Ensure TCS-001 coverage**: contract tests for examples vs schemas; pattern-specific tests (e.g., connector error mapping, commander exit code mapping).
4. **Ensure OCS alignment**: pure factory pattern, secrets as keys only, explicit allowOutbound.

