---
name: ecosystem-patterns-primitives
description: Apply Golden Path runtime tetrad and core patterns (Connector, Transformer, Commander, Guardian, Reasoner) when designing or classifying automation components.
---

# Ecosystem Patterns and Primitives

Use this skill when classifying or designing components in the automation ecosystem: Orchestrator (Temporal), Reasoner (LangGraph), Contract (OCS), Executable (Dagger runtime), and the five core patterns.

## When to Use

- Explaining or implementing the Runtime Tetrad (Orchestrator, Reasoner, Contract, Executable)
- Choosing or reviewing pattern type: Connector (API), Transformer (pure), Commander (CLI), Guardian (HITL/guardrails), Reasoner (agentic)
- Applying pattern-specific baselines (spec-driven, error normalization, OIDC, determinism)
- Using dependency-injection primitives or cross-cutting concerns

## Instructions

1. **Runtime Tetrad:** Orchestrator = Blueprint (deterministic, durable). Reasoner = Agent (probabilistic, LangGraph). Contract = OCS Capability (schemas, boundary). Executable = runtime inside Dagger (implementation).
2. **Patterns:** Connector—API integration, spec-driven, error normalization. Transformer—pure logic, side-effect free. Commander—CLI/SDK, OIDC, structured logging. Guardian—HITL, guardrails, audit. Reasoner—LangGraph, MCP, semantic memory, token-aware.
3. **Primitives:** Use the standard’s dependency-injection and cross-cutting primitives when wiring capabilities and workflows.

For the full document, see **references/ecosystem-patterns-primitives.mdx**.
