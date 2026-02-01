---
name: testing-certification-standard
description: Apply TCS-001 for contract verification, Dagger mocking, Blueprint acceptance tests, and OSCAL/compliance artifacts in CI.
---

# Testing & Certification Standard (TCS-001)

Use this skill when implementing or reviewing tests for Capabilities and Blueprints, contract verification, and certification/compliance gates.

## When to Use

- Writing or running contract tests (Zod schemas vs aiHints, metadata.id uniqueness)
- Unit testing Capabilities with Dagger mocks (@golden/test-utils)
- Acceptance testing Blueprints with Temporal test environment and Saga/compensation coverage
- Generating or verifying OSCAL/Component Definition artifacts for compliance

## Instructions

1. **Contract verification:** CI must validate InputSchema/OutputSchema against aiHints.exampleInput/exampleOutput; ensure metadata.id is unique; verify all required OCS fields exist.
2. **Capability tests:** Use Dagger mocking so the factory returns a valid Container graph without spawning real containers. Require ≥80% statement coverage on the runtime module.
3. **Blueprint tests:** Use @temporalio/testing; mock ExecuteCapability activities; verify Saga pattern by forcing failure at each step and asserting compensations run.
4. **Certification:** A project is certified when Vitest passes, OTel spans include GOS-001 attributes, and audit_capability_compliance returns PASS. CI must extract oscalControlIds and produce a CBOM (e.g., NIST/OSCAL JSON/YAML).

For the full normative standard, see **references/testing-and-certification-standard.mdx**.
