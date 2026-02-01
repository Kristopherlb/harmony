<!-- path: .cursor/skills/determinism-guardrails/references/determinism-guardrails.md -->

# Determinism Guardrails Standard (DGS-001)

| Metadata | Value |
| --- | --- |
| ID | DGS-001 |
| Version | 1.0.0 |
| Status | DRAFT |
| Authors | Platform Engineering |
| Context | Temporal workflow determinism + lint enforcement |

## 1. Scope

This standard defines how Harmony enforces determinism in workflow (Blueprint) code.

- **In scope**: prohibited APIs in workflow bundles, allowed wrappers, lint enforcement mechanisms, scope boundaries.
- **Out of scope**: runtime replay semantics of Temporal itself; general JS determinism beyond workflow bundles.

## 2. Terms

- **Workflow bundle code**: TypeScript that is compiled/bundled into Temporal workflow execution.
- **Deterministic wrapper**: A platform-provided API that is safe to use in workflow code (e.g., `this.now`, `this.uuid`, `this.sleep`).
- **Exception site**: A file/location where an otherwise prohibited API is allowed (e.g., inside the deterministic wrapper implementation itself).

## 3. Normative language

This document uses MUST/SHOULD/MAY as defined in NST-001.

## 4. Normative requirements

### 4.1 Allowed wrappers

- **REQ-DGS-001**: Workflow code MUST use deterministic wrappers provided by the platform for:
  - time (`this.now` or equivalent base wrapper)
  - randomness/UUID (`this.uuid` or equivalent)
  - sleeping (`this.sleep(ms)` or equivalent)

### 4.2 Prohibited APIs

- **REQ-DGS-010**: Workflow bundle code MUST NOT call:
  - `Date` / `Date.now()` directly (outside wrapper)
  - `Math.random()`
  - `setTimeout`
- **REQ-DGS-011**: Other non-deterministic sources (process env reads, filesystem reads) SHOULD be prohibited in workflow bundle code, but are not FAIL-enforced until an explicit lint rule exists (future DGS revision).

### 4.3 Enforcement mechanism

- **REQ-DGS-020**: Determinism guardrails MUST be enforced via lint rules.
- **REQ-DGS-021**: DGS enforcement MUST specify:
  - lint layers used (ESLint rules and selectors)
  - the exact file globs that define “workflow bundle code”
  - the exception list (wrapper implementation sites)

**Workflow bundle globs (normative)**

- **REQ-DGS-022**: “Workflow bundle code” MUST be defined (at minimum) as:
  - `packages/blueprints/src/workflows/**/*.ts`

**Exception sites (normative)**

- **REQ-DGS-023**: The only allowed exception site for direct `Date.now()` usage is the deterministic wrapper implementation in:
  - `packages/core/src/wcs/base-blueprint.ts`
  - Any additional exception sites MUST be explicitly enumerated in this document in a future revision.

### 4.4 Regression strategy

- **REQ-DGS-030**: The repo MUST include regression coverage ensuring:
  - the lint rules apply to workflow bundle directories
  - wrapper exception sites do not cause false positives

## 5. Validation rules

- **VAL-DGS-001**:
  - **Input(s)**: workflow bundle source files
  - **Rule**: no matches for prohibited API selectors (policy-defined selectors)
  - **Fail message**: `DGS_NONDETERMINISTIC_API_USED`
  - **Severity**: FAIL
  - **Autofix**: NO

- **VAL-DGS-010**:
  - **Input(s)**: lint configuration
  - **Rule**: lint config includes guardrails scoped to workflow bundle globs and includes an explicit exception list
  - **Fail message**: `DGS_LINT_SCOPE_NOT_DEFINED`
  - **Severity**: FAIL
  - **Autofix**: NO

## 6. Test vectors

### 6.1 Date usage in workflow code

- **Given**: a workflow file containing `Date.now()`
- **When**: lint runs over workflow bundle code
- **Then**: FAIL with `DGS_NONDETERMINISTIC_API_USED`

### 6.2 Wrapper exception site allowed

- **Given**: base wrapper implementation uses `Date.now()` internally
- **When**: lint runs
- **Then**: PASS (exception site)

### 6.3 setTimeout usage

- **Given**: a workflow file calling `setTimeout(fn, 10)`
- **When**: lint runs
- **Then**: FAIL with `DGS_NONDETERMINISTIC_API_USED`

## 7. Examples (non-normative)

Recommended lint selectors (illustrative):

- `MemberExpression[object.name='Date']`
- `NewExpression[callee.name='Date']`
- `MemberExpression[object.name='Math'][property.name='random']`
- `CallExpression[callee.name='setTimeout']`

## 8. Changelog

### 1.0.0

- Initial determinism guardrails spec (lint-scoped, exception-aware).

