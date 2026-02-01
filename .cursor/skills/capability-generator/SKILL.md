---
name: capability-generator
description: Generate OCS-compliant capability and runtime code from high-level intent and API/CLI documentation. Use when creating new provider components.
---

# Capability Generator (generate_capability_component)

Use this skill when the user wants to generate a new Capability from API docs (OpenAPI, GraphQL) or CLI help, following the Open Capability Standard and Agent Specification Standard.

## When to Use

- User asks to build a "Connector," "Transformer," "Commander," or "Reasoner" capability
- Creating capability.ts and runtime logic from external API/CLI documentation
- Generating Zod schemas and Dagger factory code for a new integration

## Instructions

1. **Categorize:** Choose pattern—CONNECTOR (API), TRANSFORMER (pure logic), COMMANDER (CLI), or REASONER (LangGraph). Apply the corresponding baselines (error normalization, OIDC, state schema, etc.).
2. **Schemas:** Define Input, Output, Config, and Secrets with Zod; use semantic validators and `.describe()` on every field.
3. **Factory:** Implement a pure factory returning a Dagger Container (or LangGraph checkpointer for Reasoner). Use `ctx.secretRefs` and `.withMountedSecret()`; never pass secrets as env vars.
4. **Metadata & security:** Set metadata (id, description, tags), aiHints (exampleInput, exampleOutput, usageNotes), security (requiredScopes, classification, networkAccess), and operations (idempotency, retryPolicy, errorMap).
5. **Output:** Emit only valid, compilable TypeScript for capability and runtime. Do not wrap in markdown code blocks if it prevents direct file writing.

The full system prompt and reference implementation are in **references/generate-capability-component.md**. Follow OCS and ASS-001 where applicable.
