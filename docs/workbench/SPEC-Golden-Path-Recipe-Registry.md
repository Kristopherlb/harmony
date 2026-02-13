# SPEC: Golden Path Recipe Registry

Status: Approved  
Scope: deterministic recipe schema and selector inputs for Workbench generation pipeline

Skills used:

- `.cursor/skills/strategic-planning-protocol/SKILL.md`
- `clean-architecture`
- `test-driven-development`

---

## 1. Objective

Reduce generation variance by introducing reusable recipes that map user goals to recommended, policy-aware tool chains.

---

## 2. Recipe Contract (v1)

A recipe MUST define:

- `id`: stable identifier
- `goal`: concise intent statement
- `recommendedToolChain`: ordered list of tool IDs or capability identifiers
- `preflightRules`: required validations before run
- `approvalRequirements`: required approval tiers/constraints
- `rollbackNotes`: deterministic rollback guidance

Optional fields:

- `domain`
- `tags`
- `successSignals`

---

## 3. Selector Constraints

Selector/ranker MUST be deterministic for the same inputs:

- user intent class
- currently available tools/catalog
- classification and approval constraints
- preflight compatibility

Selector MUST NOT use nondeterministic randomness in baseline mode.

When multiple recipes are valid:

- system SHOULD provide short trade-offs and allow explicit user selection.

---

## 4. Initial Seeded Use Cases

Minimum initial recipe coverage:

- Incident triage and communications
- Progressive rollout verify and rollback
- Release gate validation

---

## 5. Validation

Contract checks:

- Schema validation for recipe shape and required fields.
- Deterministic selection tests for fixed inputs.

Local smoke checks:

- One representative prompt per seeded use case returns stable recipe choice.
- Fallback behavior is stable when no recipe matches.

---

## 6. Implementation Touchpoints

- `packages/apps/console/shared/schema.ts`
- `packages/apps/console/server/services/openai-agent-service.ts`
- `packages/apps/console/server/agent/prompts/blueprint-generation.ts`
- `packages/core/src/templates/catalog`

