---
name: architect-workflow-logic
description: Design high-fidelity Blueprint architectures (JSON execution plans) from user intent using Temporal best practices and WCS-001. Use when decomposing automation requests into workflows.
---

# Architect Workflow Logic (architect_workflow_logic)

Use this skill when the user wants to turn ambiguous automation intent into a deterministic "Blueprint Architecture" (JSON plan) that adheres to Temporal and Golden Path (WCS-001) before implementation.

## When to Use

- User describes a multi-step automation or workflow goal in natural language
- Decomposing requests into a sequence of capabilities, parallel groups, and compensations
- Defining acceptance tests and security/HITL requirements before coding
- Discovering capabilities from MCP and identifying missing dependencies or required actions

## Instructions

1. **TDD-first:** Define success and failure criteria (acceptance tests) before designing the flow. Use test-driven-development practices.
2. **Ambiguity guardrail:** If intent is unclear (e.g., missing target channel, project key), ask the user; do not guess. Trigger HITL clarification when needed.
3. **Capability discovery:** Query the MCP Registry for capabilities. List "Required Developer Actions" (e.g., secrets, OAuth) and "Missing Dependencies" when something is absent.
4. **Security & compliance:** Determine Keycloak roles and HITL requirements from data classification.
5. **Orchestration:** Order steps by data dependencies; group parallelizable tasks; inject Saga/compensation design. Minimize APS; prefer batching over large fan-outs.
6. **Output:** Produce a JSON Blueprint Architecture suitable for the generate-blueprint-code assembly engine.

For the full system prompt and engineering principles, see **references/architect-workflow-logic.mdx**.
