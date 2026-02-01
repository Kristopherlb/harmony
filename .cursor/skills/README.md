# Project skills (Cursor Agent Skills)

Skills in this directory follow the [Cursor Agent Skills](https://cursor.com/docs/context/skills) layout: each skill is a folder with a `SKILL.md` file (required) and optional `scripts/`, `references/`, and `assets/`.

**Canonical standard content** lives here: each skill’s **`references/`** directory holds the full normative documents (moved from `standards/`). Each `SKILL.md` contains:

- YAML frontmatter: `name`, `description`
- **When to Use** and **Instructions**
- A pointer to **references/** for the full standard text

## Skill ↔ reference files

| Skill (`.cursor/skills/<name>/`) | Reference (in that skill’s `references/`) |
|----------------------------------|-------------------------------------------|
| `agent-specification-standard` | `agent-specification-standard.md` (ASS-001) |
| `agent-interaction-protocol` | `agent-interaction-protocol.mdx` (AIP-001) |
| `agent-decision-records` | `agent-decision-records.md` (ADR-AGENT-001) |
| `prompt-engineering` | `prompt-engineering.mdx` (PES-001) |
| `open-capability-standard` | `open-capability-standard.mdx` (OCS) |
| `capability-generator` | `generate-capability-component.md` |
| `capability-quality-assurance` | (see testing + OCS skill references) |
| `workflow-composition-standard` | `workflow-composition-standard.mdx` (WCS-001) |
| `architect-workflow-logic` | `architect-workflow-logic.mdx` |
| `activity-envelope-standard` | `activity-envelope-standard.md` (AECS-001) |
| `blueprint-descriptor-standard` | `blueprint-descriptor-standard.md` (BDS-001) |
| `certification-and-audit` | `certification-and-audit.md` (CAS-001) |
| `classification-semantics-standard` | `classification-semantics-standard.md` (CSS-001) |
| `determinism-guardrails` | `determinism-guardrails.md` (DGS-001) |
| `generator-scaffolding-standard` | `generator-and-scaffolding-standard.mdx` (GSS-001) |
| `naming-and-identity-standard` | `naming-and-identity-standard.md` (NIS-001) |
| `normative-standard-template` | `normative-standard-template.md` (NST-001) |
| `pattern-catalog-blueprints` | `pattern-catalog-blueprints.md` (BPC-001) |
| `pattern-catalog-capabilities` | `pattern-catalog-capabilities.md` (CPC-001) |
| `testing-certification-standard` | `testing-and-certification-standard.mdx` (TCS-001) |
| `generate-blueprint-code` | `generate-blueprint-code.md` |
| `generate-golden-dashboard` | `generate-golden-dashboard.md` |
| `golden-observability` | `golden-observability.mdx` (GOS-001) |
| `infrastructure-secrets` | `infrastructure-secrets.md` (ISS-001) |
| `design-compensation-strategy` | `design-compensation-strategy.md` |
| `ecosystem-patterns-primitives` | `ecosystem-patterns-primitives.mdx` |
| `unified-identity-model` | `unified-identity-model.mdx` (UIM-001) |
| `usecase-refinement-protocol` | `usecase-refinement-protocol.md` (URP-001) |
| `versioning-and-compatibility-standard` | `versioning-and-compatibility-standard.md` (VCS-001) |

## Optional next steps

- **scripts/**  
  Add runnable scripts (e.g. validation, codegen) under `scripts/` and reference them from `SKILL.md` for agent-driven execution.

- The old **`standards/`** directory is now a stub with a README pointing here; all content was moved into these skills’ `references/`.
