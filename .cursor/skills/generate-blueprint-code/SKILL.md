---
name: generate-blueprint-code
description: Generate production-ready BaseBlueprint TypeScript and tests from a JSON Blueprint Architecture. Use when assembling workflow code from an architect output.
---

# Generate Blueprint Code (generate_blueprint_code)

Use this skill when you have a validated JSON Blueprint Architecture (from architect-workflow-logic) and need to produce compilable BaseBlueprint classes and TDD suites without ad-hoc logic.

## When to Use

- Converting a JSON DAG/architecture plan into TypeScript Blueprint implementation
- Scaffolding blueprint.ts, blueprint.test.ts, and blueprint.config.json
- Wiring steps to ExecuteCapability calls, input mapping, parallelism, and Saga compensations

## Instructions

1. **Input:** Consume a validated JSON Blueprint Architecture; treat it as a strict AST. Do not hallucinate—map only to pre-defined templates and `this.execute(Capability, input)` patterns.
2. **Secrets:** Map logical secret names to OCS SecretSchema only; do not require or validate secret values at assembly time (late-binding).
3. **Scaffolding:** Create packages/blueprints/{namespace}/{use_case}, index.ts, metadata and security from the JSON. Synthesize a unified inputSchema from DAG step requirements (Schema Registry).
4. **Logic:** Generate the workflow logic by iterating DAG steps; use input_mapping for data wiring; wrap parallel steps in Promise.all(); apply batching if aps_strategy is batched. Inject addCompensation after each step that has a defined compensation.
5. **Tests:** Generate blueprint.test.ts for each acceptance_tests scenario using TestWorkflowEnvironment; mock all Capability activities.
6. **Output:** Emit blueprint.ts, blueprint.test.ts, blueprint.config.json.

For the full assembly spec, see **references/generate-blueprint-code.md**.
