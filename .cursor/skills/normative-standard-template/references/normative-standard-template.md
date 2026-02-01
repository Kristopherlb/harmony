<!-- path: .cursor/skills/normative-standard-template/references/normative-standard-template.md -->

# Normative Standard Template (NST-001)

| Metadata | Value |
| --- | --- |
| ID | NST-001 |
| Version | 1.0.0 |
| Status | DRAFT |
| Authors | Platform Engineering |
| Context | Harmony standards-as-skills |

## 1. Scope

State exactly what this standard applies to and what it explicitly does not apply to.

- **In scope**: list artifact types, packages, directories, and interfaces covered.
- **Out of scope**: list adjacent concerns explicitly excluded.

## 2. Terms (canonical glossary)

Define canonical terms. **One concept = one term.** Do not introduce aliases (e.g., do not write `runAs/initiator`).

Recommended format:

- **TermName**: definition. Include type/shape if the term is a JSON object (e.g., `initiator`).

## 3. Normative language

Use RFC-style normative keywords:

- **MUST**: required for compliance; violations must fail certification gates unless explicitly downgraded.
- **SHOULD**: strongly recommended; violations may warn during adoption.
- **MAY**: optional; if implemented, additional constraints may apply.

If a requirement can be machine-checked, include a **Validation Rule** for it.

## 4. Normative requirements

Write requirements as numbered sections with unambiguous constraints. Prefer declarative rules over prose.

Example structure:

### 4.1 Requirement group name

- **REQ-<STANDARD>-<NNN>**: Statement using MUST/SHOULD/MAY.
- **Rationale (optional)**: why the requirement exists (keep short).

## 5. Validation rules (machine-checkable)

For each MUST (and key SHOULD), define one or more validation rules.

Recommended format:

- **VAL-<STANDARD>-<NNN>**:
  - **Input(s)**: what the checker reads (files, JSON, registry maps, manifests).
  - **Rule**: a precise condition.
  - **Fail message**: stable, code-like message.
  - **Severity**: FAIL or WARN (during migration).
  - **Autofix**: YES/NO (if a generator can fix it deterministically).

## 6. Test vectors (required)

Provide at least **3** test vectors that can later become fixtures. These must be copy/pasteable.

Recommended format:

### 6.1 Test vector name

- **Given**: input artifact(s)
- **When**: validation/audit runs
- **Then**: expected outcome (PASS/FAIL + specific failures)

## 7. Examples (non-normative)

Examples clarify intent but are not binding. Keep these clearly labeled as non-normative.

## 8. Changelog

Track changes. Each version bump must note:

- Breaking changes
- Migrations required
- New validation rules and their default severities

