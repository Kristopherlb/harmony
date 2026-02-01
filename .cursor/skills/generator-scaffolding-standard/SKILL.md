---
name: generator-scaffolding-standard
description: Apply GSS-001 when scaffolding Capabilities, Blueprints, or Agents with Nx generators and monorepo structure.
---

# Generator & Scaffolding Standard (GSS-001)

Use this skill when creating new artifacts (Capabilities, Blueprints, Agents) or enforcing monorepo layout, Nx generators, and configuration baselines.

## When to Use

- Scaffolding new capabilities, blueprints, or agents via Nx generators
- Defining or following monorepo directory structure (packages/agents, blueprints, capabilities, core, tools)
- Setting project.json tags, module-boundary rules, or dependency mappings
- Ensuring new code follows type/capability/blueprint boundaries and naming conventions

## Instructions

1. **Structure:** Use the canonical layout—packages/agents, blueprints, capabilities, core, tools; infra at repo root. No ad-hoc directory creation; use generators.
2. **Generators:** Use `nx g @golden/path:capability` (name, pattern, classification) and `nx g @golden/path:blueprint` (name, namespace, security_roles) for new artifacts. Generators produce capability.ts, runtime/, tests, project.json, and MCP registration where applicable.
3. **Config:** All project.json must use kebab-case names, tags (type, security), and Nx module-boundary rules (e.g., Capability must not import Blueprint).
4. **Dependencies:** Map to the shared core/ and OCS/WCS packages as defined in the standard.

For the full standard and generator contracts, see **references/generator-and-scaffolding-standard.mdx**.
