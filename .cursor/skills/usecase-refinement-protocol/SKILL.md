---
name: usecase-refinement-protocol
description: Standardize working with a user to refine a use case into structured artifacts (brief, acceptance tests, capability gaps) for deterministic architecture and code generation.
---

## Use Case Refinement Protocol (URP-001)

Use this skill to turn ambiguous user intent into **typed, repeatable inputs** for architects (`architect-workflow-logic`) and generators (`generate-blueprint-code`, capability generators).

### When to Use

- Starting a new blueprint/capability initiative from a user request
- The user’s goal is clear but constraints (security, classification, roles, SLAs) are incomplete
- You need deterministic acceptance tests before generating code (TCS-001 alignment)

### Required outputs (artifacts)

- `usecase_brief.json`
- `acceptance_tests.json`
- `capability_gap_analysis.json`

### Instructions

1. **Capture objective**: user goal, success criteria, and non-goals.
2. **Capture constraints**: classification (CSS-001), roles/scopes (UIM/OCS), outbound network needs (OCS), SLAs (WCS), HITL points (ASS/AIP).
3. **Draft acceptance tests first** (TCS-001 mindset): scenarios + expected outputs + failure cases.
4. **Inventory capabilities**: map required steps to existing capabilities; mark missing as gaps and classify each as connector/transformer/commander/guardian/reasoner.
5. **Produce JSON artifacts** with stable ordering and explicit defaults (no implicit “maybe” fields).

See `references/usecase-refinement-protocol.md` for the normative protocol and JSON shapes.

