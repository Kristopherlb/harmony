<!-- path: .cursor/skills/versioning-and-compatibility-standard/references/versioning-and-compatibility-standard.md -->

# Versioning & Compatibility Standard (VCS-001)

| Metadata | Value |
| --- | --- |
| ID | VCS-001 |
| Version | 1.0.0 |
| Status | DRAFT |
| Authors | Platform Engineering |
| Context | SemVer for OCS/WCS artifacts + Temporal compatibility |

## 1. Scope

This standard defines how Harmony artifacts are versioned and how compatibility is assessed.

- **In scope**: Capability `metadata.version`, Blueprint `metadata.version`, descriptor versions, schema evolution, behavioral changes, deprecations, certification interpretation.
- **Out of scope**: release packaging and distribution mechanics (e.g., npm publish); CI enforcement mechanics (defined by CAS-001).

## 2. Terms

- **SemVer**: Semantic Versioning `MAJOR.MINOR.PATCH`.
- **Contract**: Artifact boundary defined by schemas (input/output/config/secrets) and required security/behavioral properties.
- **Breaking change**: A change requiring a MAJOR version bump.
- **Deprecation**: A supported feature/field/ID marked for removal under a defined policy window.

## 3. Normative language

This document uses MUST/SHOULD/MAY as defined in NST-001.

## 4. Normative requirements

### 4.1 Version format and placement

- **REQ-VCS-001**: `metadata.version` MUST be SemVer.
- **REQ-VCS-002**: Versions MUST NOT be embedded in `metadata.id`.

### 4.2 Capability versioning rules

- **REQ-VCS-010**: A capability MUST bump **MAJOR** when:
  - `schemas.input` becomes more restrictive (removes fields, narrows types, makes optional fields required).
  - `schemas.output` changes in a way that breaks existing consumers.
  - required security scopes change in a way that reduces previously granted access expectations (policy-defined).
- **REQ-VCS-011**: A capability SHOULD bump **MINOR** when:
  - new optional input fields are added
  - new output fields are added without breaking existing fields
  - operational defaults change in a backwards-compatible way (e.g., adding metrics)
- **REQ-VCS-012**: A capability MAY bump **PATCH** for:
  - bug fixes without contract changes
  - documentation and description improvements

### 4.3 Blueprint versioning rules (Temporal compatibility)

- **REQ-VCS-020**: A blueprint MUST bump **MAJOR** when its externally visible contract changes (input schema or promised outputs for MCP exposure).
- **REQ-VCS-021**: A blueprint MUST bump at least **MINOR** when adding new steps, new capabilities, or new compensations, even if input schema is unchanged.
- **REQ-VCS-022**: Blueprint changes MUST comply with Temporal determinism constraints (WCS). If a change is incompatible with in-flight histories, it MUST be released via a compatible rollout mechanism (e.g., worker versioning/build IDs per WCS) and documented in the changelog.

### 4.4 Deprecation policy

- **REQ-VCS-030**: Deprecations MUST include:
  - what is deprecated (field/ID/behavior)
  - replacement path
  - effective date or release count for end-of-life
- **REQ-VCS-031**: During the deprecation window, audits MUST emit WARN; after end-of-life, audits MUST FAIL.

## 5. Validation rules

- **VAL-VCS-001**:
  - **Input(s)**: Artifact metadata versions.
  - **Rule**: version matches `^\\d+\\.\\d+\\.\\d+$`.
  - **Fail message**: `VCS_VERSION_NOT_SEMVER`
  - **Severity**: FAIL
  - **Autofix**: NO

- **VAL-VCS-010**:
  - **Input(s)**: Previous release schemas vs current schemas (diff).
  - **Rule**: breaking schema diff implies MAJOR bump (policy-defined diff rules).
  - **Fail message**: `VCS_BREAKING_SCHEMA_CHANGE_WITHOUT_MAJOR_BUMP`
  - **Severity**: FAIL
  - **Autofix**: NO

- **VAL-VCS-030**:
  - **Input(s)**: Deprecation declarations + current date/release.
  - **Rule**: after EOL, deprecated surface must not be present or must fail compliance.
  - **Fail message**: `VCS_DEPRECATION_EOL_VIOLATION`
  - **Severity**: FAIL
  - **Autofix**: NO

## 6. Test vectors

### 6.1 Adding optional input field

- **Given**: `schemas.input` adds a new optional field
- **When**: version policy check runs
- **Then**: MINOR bump required; MAJOR not required

### 6.2 Removing output field used by consumers

- **Given**: `schemas.output` removes a previously present field
- **When**: version policy check runs
- **Then**: MAJOR bump required

### 6.3 Deprecation lifecycle

- **Given**: field `x` deprecated with EOL after 2 minor releases
- **When**: audit runs before EOL
- **Then**: WARN
- **When**: audit runs after EOL
- **Then**: FAIL with `VCS_DEPRECATION_EOL_VIOLATION`

## 7. Examples (non-normative)

- Adding `timeout_ms?: number` to input schema: MINOR
- Fixing a retryable error category mapping bug without contract change: PATCH

## 8. Changelog

### 1.0.0

- Initial SemVer and deprecation policy for Harmony artifacts.

