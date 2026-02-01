---
name: normative-standard-template
description: Use when authoring or updating any Harmony normative standard to keep structure, terminology, and validation/test vectors consistent across specs.
---

## Normative Standard Template (NST-001)

Use this skill when writing any normative spec (e.g., NIS-001, VCS-001, BDS-001, AECS-001, DGS-001, CAS-001, CSS-001).

### When to Use

- Creating a new standard under `.cursor/skills/<skill>/references/`
- Updating an existing standard where style/sections drifted
- Adding validation rules or test vectors to make a spec implementable

### Instructions

1. **Create/Update the reference doc** to match the NST-001 template in `references/normative-standard-template.md`.
2. **Pin terminology** in a Terms section: one canonical term per concept; avoid aliases like `runAs/initiator`.
3. **Write normative requirements** using MUST/SHOULD/MAY and include a validation rule for each MUST whenever possible.
4. **Add test vectors** (minimum 3) that are copy/pasteable and will later become contract tests and audit fixtures.
5. **Keep examples non-normative** and clearly separated from requirements.

For the full template and rule language guidance, see `references/normative-standard-template.md`.

