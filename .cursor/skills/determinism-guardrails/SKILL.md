---
name: determinism-guardrails
description: Apply DGS-001 to enforce Temporal determinism constraints via linting scope, exceptions, and regression checks.
---

## Determinism Guardrails Standard (DGS-001)

Use this skill when writing or auditing workflow code and the lint rules that enforce determinism.

### When to Use

- Adding new blueprint/workflow code that will be bundled for Temporal
- Tightening or scoping determinism lint rules
- Writing regression checks to prevent determinism drift

### Instructions

1. **Use wrappers only** for time/uuid/sleep in workflow code.
2. **Ban non-deterministic APIs** (Date/Math.random/setTimeout/etc.) outside the sanctioned wrapper implementation sites.
3. **Scope lint correctly**: define exact workflow bundle globs and exception lists.
4. **Add regression coverage** ensuring lint applies where intended.

See `references/determinism-guardrails.md` for the normative specification.

