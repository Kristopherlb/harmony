<!-- path: .cursor/skills/blueprint-descriptor-standard/references/blueprint-descriptor-standard.md -->

# Blueprint Descriptor Standard (BDS-001)

| Metadata | Value |
| --- | --- |
| ID | BDS-001 |
| Version | 1.0.0 |
| Status | DRAFT |
| Authors | Platform Engineering |
| Context | Node/TypeScript discovery contract for WCS Blueprints + MCP manifests |

## 1. Scope

This standard defines the **TypeScript/Node descriptor contract** for Blueprints so that:

- Blueprints are discoverable without bundling Temporal workflow code.
- MCP manifests can be generated deterministically from descriptors.
- Audits/certification can validate governance fields consistently.

- **In scope**: descriptor types, required fields, schema exposure rules, classification and security metadata.
- **Out of scope**: runtime workflow behavior (WCS) and activity execution envelopes (AECS-001).

## 2. Terms

- **Blueprint**: A WCS workflow extending BaseBlueprint.
- **Descriptor**: A Node-safe object describing a Blueprint for discovery and manifest generation.
- **MCP exposed**: The descriptor is included in the MCP tool manifest.
- **Schema exposure**: Which schemas are included in the descriptor and manifest.
- **Canonical field mapping**: The cross-standard mapping table defined in AECS-001 Appendix B; other standards MUST reference it to avoid alias drift.

## 3. Normative language

This document uses MUST/SHOULD/MAY as defined in NST-001.

## 4. Normative requirements

### 4.1 Descriptor identity and consistency

- **REQ-BDS-001**: The descriptor MUST include `metadata.id` and it MUST equal `blueprintId`.
- **REQ-BDS-002**: The descriptor MUST include `workflowType` (the Temporal workflow type string).
- **REQ-BDS-003**: The registry entry key MUST equal `metadata.id` (NIS-001) and MUST map to this descriptor.

### 4.2 Governance metadata

- **REQ-BDS-010**: The descriptor MUST include:
  - `metadata`: `{ id, version, name, description, owner, costCenter, tags }`
  - `security`: `{ requiredRoles, classification, oscalControlIds? }`
  - `operations`: `{ sla, alerting? }`

### 4.3 Schemas

- **REQ-BDS-020**: The descriptor MUST include:
  - `schemas.input`
  - `schemas.config`
- **REQ-BDS-021**: If the Blueprint is MCP exposed, the descriptor MUST include `schemas.output`.

### 4.4 AI hints

- **REQ-BDS-030**: The descriptor MUST include `aiHints.exampleInput` and it MUST validate against `schemas.input`.
- **REQ-BDS-031**: If the Blueprint is MCP exposed, the descriptor MUST include `aiHints.exampleOutput` and it MUST validate against `schemas.output`.

### 4.5 Classification semantics

- **REQ-BDS-040**: The descriptor MUST declare `security.classification` and it MUST follow CSS-001 semantics.
- **REQ-BDS-041**: Field naming MUST follow the canonical mapping table (AECS-001 Appendix B) and MUST NOT introduce new aliases for classification or initiator identity.

## 5. Validation rules

- **VAL-BDS-001**:
  - **Input(s)**: descriptor objects
  - **Rule**: `descriptor.blueprintId === descriptor.metadata.id`
  - **Fail message**: `BDS_BLUEPRINT_ID_MISMATCH`
  - **Severity**: FAIL
  - **Autofix**: NO

- **VAL-BDS-020**:
  - **Input(s)**: descriptor schemas + aiHints
  - **Rule**: `schemas.input.parse(aiHints.exampleInput)` succeeds
  - **Fail message**: `BDS_EXAMPLE_INPUT_INVALID`
  - **Severity**: FAIL
  - **Autofix**: NO

- **VAL-BDS-021**:
  - **Input(s)**: descriptor schemas + aiHints + exposure policy
  - **Rule**: if MCP exposed, `schemas.output` exists and `schemas.output.parse(aiHints.exampleOutput)` succeeds
  - **Fail message**: `BDS_OUTPUT_SCHEMA_OR_EXAMPLE_OUTPUT_MISSING_OR_INVALID`
  - **Severity**: FAIL
  - **Autofix**: NO

## 6. Test vectors

### 6.1 ID consistency

- **Given**: descriptor with `blueprintId = workflows.echo` but `metadata.id = workflows.DIFFERENT`
- **When**: descriptor audit runs
- **Then**: FAIL with `BDS_BLUEPRINT_ID_MISMATCH`

### 6.2 MCP-exposed blueprint requires output schema + example output

- **Given**: MCP exposed blueprint descriptor missing `schemas.output`
- **When**: audit runs
- **Then**: FAIL with `BDS_OUTPUT_SCHEMA_OR_EXAMPLE_OUTPUT_MISSING_OR_INVALID`

### 6.3 Example input validation

- **Given**: `schemas.input` requires `{ x: number }` but `exampleInput = {}`
- **When**: audit runs
- **Then**: FAIL with `BDS_EXAMPLE_INPUT_INVALID`

## 7. Examples (non-normative)

Suggested descriptor layout:

- `blueprintId`, `workflowType`
- `metadata` (governance)
- `security` (roles/classification)
- `operations` (SLA/alerting)
- `schemas` (input/config/output)
- `aiHints` (exampleInput/exampleOutput/usageNotes)

## 8. Changelog

### 1.0.0

- Initial Node/TypeScript descriptor contract for Blueprints.

