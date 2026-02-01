---
name: design-compensation-strategy
description: Design and inject Saga compensation blocks for Blueprints so every mutating step has a deterministic rollback path. Use when implementing resilient workflows.
---

# Design Compensation Strategy (design_compensation_strategy)

Use this skill when a Blueprint or JSON architecture contains mutating steps and you need to add robust, LIFO-ordered compensation logic and corresponding test cases.

## When to Use

- Adding addCompensation blocks to a BaseBlueprint or architecture
- Identifying non-reversible actions and defining HITL or manual remediation
- Matching "Undo" capabilities from the MCP Registry for Connectors/Commanders
- Writing or extending blueprint tests for failure-and-rollback scenarios

## Instructions

1. **Mutation analysis:** Scan for this.execute() calls that are not read-only (Connectors, Commanders). Categorize as CREATE, UPDATE, DELETE, PROVISION.
2. **Semantic matching:** Query MCP Registry for Undo capabilities (e.g., create_issue → delete_issue). If no match, ask the user (HITL) for compensation tool ID or strategy.
3. **Non-reversible guardrails:** For "point of no return" actions (e.g., payments, physical world), require a manual gate or compensation log step for human remediation. Do not ignore.
4. **Code injection:** Insert addCompensation immediately after the successful step; capture IDs from step output for the compensation call. Ensure compensations are idempotent and use the same runAs context.
5. **Tests:** Add negative scenarios: force step failure, exhaust retries, assert all prior compensations were called (test-driven-development).
6. **Output:** Provide Saga design summary, updated Blueprint code with compensations, and updated blueprint.test.ts with rollback assertions.

For the full system prompt, see **references/design-compensation-strategy.md**.
