---
name: capability-quality-assurance
description: Audit and verify OCS capability compliance, contract tests, and quality gates before deployment.
---

# Capability Quality Assurance

Use this skill when auditing capabilities for OCS adherence, running contract verification, or ensuring quality and compliance gates before release.

## When to Use

- Validating that a capability meets OCS schema, security, and metadata requirements
- Running or designing contract tests (e.g., aiHints vs Input/Output schemas)
- Preparing capabilities for certification or CI gates (e.g., audit_capability_compliance)

## Instructions

1. **Contract verification:** Ensure InputSchema/OutputSchema validate against aiHints.exampleInput/exampleOutput; verify metadata.id is unique; confirm all required OCS fields are present.
2. **Security & operations:** Check secrets (keys only in schema, mounted at runtime), network allowlists, and errorMap/retryPolicy.
3. **CI integration:** Use contract tests and any project-specific audit tool (e.g., audit_capability_compliance) as certification gates.

For related requirements, see the testing-certification-standard and open-capability-standard skills (references/ in those skill folders).
