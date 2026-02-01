---
name: prompt-engineering
description: Apply PES-001 when writing, versioning, or testing LLM prompts and skill definitions for agents.
---

# Prompt Engineering Standard (PES-001)

Use this skill when creating or updating agent prompts, skill definitions, or prompt tests so behavior is reproducible and resilient to model changes.

## When to Use

- Writing or refactoring system prompts for agents
- Defining skill files (.md) that encode agent capabilities
- Structuring prompts for clear instruction-following and injection resistance
- Versioning and testing prompts (e.g., evals, A/B tests)

## Instructions

1. **Structure:** Use the mandatory XML-style tags—`<system_role>`, `<engineering_principles>`, `<instructions>`, `<reference_example>`, `<hitl_protocol>`—so parsing and governance are consistent.
2. **Skill format:** Store each skill as a .md file with Context (role, input, output, tools) and a system prompt block. Keep prompts in the repo and treat them as code.
3. **Testing:** Version prompts and run evals (e.g., Promptfoo) so Agent behavior can be regression-tested.

For the full normative standard and skill definition format, see **references/prompt-engineering.mdx**.
