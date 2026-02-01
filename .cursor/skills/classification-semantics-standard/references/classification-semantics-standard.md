<!-- path: .cursor/skills/classification-semantics-standard/references/classification-semantics-standard.md -->

# Classification Semantics Standard (CSS-001)

| Metadata | Value |
| --- | --- |
| ID | CSS-001 |
| Version | 1.0.0 |
| Status | DRAFT |
| Authors | Platform Security + Platform Engineering |
| Context | Harmony / OCS / WCS / MCP exposure |

## 1. Scope

This standard defines the canonical semantics for **data classification** across Harmony.

- **In scope**: Capabilities (OCS), Blueprints (WCS), MCP manifests/tool surface, certification/audit reporting.
- **Out of scope**: external org/agency classification taxonomies beyond mapping into the CSS lattice.

## 2. Terms

- **Classification**: One of `PUBLIC | INTERNAL | CONFIDENTIAL | RESTRICTED`.
- **Classification lattice**: A strict ordering of classifications from least to most sensitive.
- **Derived classification**: A computed classification based on inputs/steps (e.g., a Blueprint derived from the Capabilities it invokes).
- **Declared classification**: An explicitly declared classification value in artifact metadata (e.g., `capability.security.dataClassification`).
- **Exposure**: Whether an artifact is exposed as a callable MCP tool.
- **Canonical field mapping**: The cross-standard mapping table defined in AECS-001 Appendix B; classification field names across surfaces MUST follow it.

## 3. Normative language

This document uses MUST/SHOULD/MAY as defined in NST-001.

## 4. Normative requirements

### 4.1 Classification lattice and ordering

- **REQ-CSS-001**: The classification lattice MUST be exactly:
  - `PUBLIC < INTERNAL < CONFIDENTIAL < RESTRICTED`
- **REQ-CSS-002**: All standards and implementations MUST treat the lattice ordering as canonical when comparing and enforcing classification constraints.

### 4.2 Declaration requirements

- **REQ-CSS-010**: Every OCS Capability MUST declare `security.dataClassification`.
- **REQ-CSS-011**: Every Blueprint descriptor MUST declare classification (location is defined by BDS-001).
- **REQ-CSS-012**: MCP manifest entries MUST include `data_classification` for each tool.
- **REQ-CSS-013**: Standards and implementations MUST use the canonical mapping table (AECS-001 Appendix B) for classification field names across surfaces and MUST NOT introduce new aliases.

### 4.3 Derivation rules

- **REQ-CSS-020**: A Blueprint’s **derived classification** MUST be the maximum classification of all Capabilities it invokes (by lattice order).
- **REQ-CSS-021**: A Blueprint’s **declared classification** MUST be greater than or equal to its derived classification.
  - If declared < derived: FAIL (policy violation).
  - If declared > derived: WARN unless explicitly justified (justification mechanism defined by CAS-001 evidence model).

### 4.4 Exposure rules

- **REQ-CSS-030**: If an MCP tool’s `data_classification` is `RESTRICTED`, tool invocation MUST be gated by an explicit approval flow (defined by AECS-001).
- **REQ-CSS-031**: Classification MUST be included as a first-class field in certification outputs for every artifact (defined by CAS-001).

## 5. Validation rules

- **VAL-CSS-001**:
  - **Input(s)**: Capability registry and Capability objects.
  - **Rule**: Every capability has a non-empty `security.dataClassification` that is one of the lattice values.
  - **Fail message**: `CSS_MISSING_OR_INVALID_CAPABILITY_CLASSIFICATION`
  - **Severity**: FAIL
  - **Autofix**: NO

- **VAL-CSS-010**:
  - **Input(s)**: Blueprint descriptors.
  - **Rule**: Each descriptor declares classification and it is one of the lattice values.
  - **Fail message**: `CSS_MISSING_OR_INVALID_BLUEPRINT_CLASSIFICATION`
  - **Severity**: FAIL
  - **Autofix**: NO

- **VAL-CSS-020**:
  - **Input(s)**: Blueprint workflow implementation + resolved list of invoked capability IDs; capability classifications.
  - **Rule**: `blueprint.declaredClassification >= max(invokedCapabilityClassifications)`.
  - **Fail message**: `CSS_BLUEPRINT_CLASSIFICATION_UNDERSTATED`
  - **Severity**: FAIL
  - **Autofix**: NO

- **VAL-CSS-030**:
  - **Input(s)**: MCP manifest + tool surface behavior tests.
  - **Rule**: RESTRICTED tools cannot execute without an approval artifact per AECS-001.
  - **Fail message**: `CSS_RESTRICTED_TOOL_NOT_GATED`
  - **Severity**: FAIL
  - **Autofix**: NO

## 6. Test vectors

### 6.1 Blueprint classification derived from capabilities

- **Given**:
  - Capabilities:
    - `a` classification `INTERNAL`
    - `b` classification `CONFIDENTIAL`
  - Blueprint invokes `a` then `b`
  - Blueprint declares `INTERNAL`
- **When**: classification audit runs
- **Then**: FAIL with `CSS_BLUEPRINT_CLASSIFICATION_UNDERSTATED`

### 6.2 Blueprint classification declared higher than derived

- **Given**:
  - Capabilities: all `INTERNAL`
  - Blueprint declares `CONFIDENTIAL`
- **When**: classification audit runs
- **Then**: WARN (requires justification evidence, per CAS-001)

### 6.3 RESTRICTED tool gating

- **Given**: MCP tool manifest entry with `data_classification: RESTRICTED`
- **When**: tool invoked without approval artifact
- **Then**: FAIL behavior (tool surface returns approval-required response); certification evidence includes the gating check PASS

## 7. Examples (non-normative)

Example comparison helper:

- `max(PUBLIC, INTERNAL) = INTERNAL`
- `max(INTERNAL, CONFIDENTIAL) = CONFIDENTIAL`
- `max(CONFIDENTIAL, RESTRICTED) = RESTRICTED`

## 8. Changelog

### 1.0.0

- Initial definition of classification lattice, derivation, and enforcement semantics.

