<!-- path: .cursor/skills/activity-envelope-standard/references/activity-envelope-standard.md -->

# Activity Envelope & Execution Contract Standard (AECS-001)

| Metadata | Value |
| --- | --- |
| ID | AECS-001 |
| Version | 1.0.0 |
| Status | DRAFT |
| Authors | Platform Engineering + Platform Security |
| Context | Activity invocation, MCP tool execution, identity/trace propagation |

## 1. Scope

This standard defines the **canonical request/response envelope** for executing:

- OCS Capabilities (via a platform activity runner)
- WCS Blueprints (via a blueprint runner / Temporal client)

- **In scope**: envelope JSON keys and types, approval token semantics, required evidence for certification.
- **Out of scope**: internal worker implementation details and secret storage specifics (ISS-001).

## 2. Terms

- **Envelope**: The structured JSON passed between caller and runner, and persisted as execution metadata.
- **Initiator**: The authenticated subject invoking an action.
- **Approval token**: A signed artifact authorizing RESTRICTED execution.
- **Trace**: Correlation identifiers for observability.

## 3. Normative language

This document uses MUST/SHOULD/MAY as defined in NST-001.

## 4. Normative requirements

### 4.1 Canonical initiator shape

- **REQ-AECS-001**: The envelope MUST include:

```json
{
  "initiator": {
    "subjectId": "user:alice",
    "roles": ["roleA", "roleB"],
    "tenantId": "tenant-optional"
  }
}
```

- **REQ-AECS-002**: New envelope producers MUST NOT emit alias fields (e.g., `runAs`, `initiatorId` at the top level).

### 4.2 Canonical trace shape

- **REQ-AECS-010**: The envelope MUST include:

```json
{
  "trace": {
    "traceId": "trace-123"
  }
}
```

### 4.3 Canonical invocation targets

- **REQ-AECS-020**: Capability execution MUST use `capabilityId` (canonical ID per NIS-001).
- **REQ-AECS-021**: Blueprint execution MUST use `blueprintId` (canonical ID per NIS-001).

### 4.4 Canonical payload fields

- **REQ-AECS-030**: The envelope MUST include `input` (validated against the tool schema).
- **REQ-AECS-031**: If the tool exposure policy requires config, the envelope MUST include `config` and it MUST be validated.

### 4.5 Policy context fields

- **REQ-AECS-040**: The envelope MUST include:
  - `classification` (CSS-001 lattice)
  - `costCenter`
  - `goldenContext` (when required by WCS/worker execution; may be omitted for pure client-side blueprint starts if not applicable)

### 4.6 RESTRICTED approval token

- **REQ-AECS-050**: If `classification` is `RESTRICTED`, execution MUST require a signed approval token.
- **REQ-AECS-051**: The approval token claims MUST include:
  - `toolId` (the canonical ID)
  - `initiator.subjectId`
  - `trace.traceId`
  - `issuedAt`, `expiresAt`
  - `scope` (at minimum: `execute`)
- **REQ-AECS-052**: The approval token MUST be transported in a single canonical field:
  - `approvalToken: string`

### 4.7 Evidence for certification

- **REQ-AECS-060**: Implementations MUST emit evidence that:
  - input validation occurred
  - initiator identity propagation occurred
  - approval token verification occurred (for RESTRICTED)
  - secret resolution did not accept raw secret values (ISS-001)

## 5. Validation rules

- **VAL-AECS-001**:
  - **Input(s)**: envelope JSON
  - **Rule**: `initiator.subjectId` is a non-empty string, `initiator.roles` is an array of strings
  - **Fail message**: `AECS_INVALID_INITIATOR_SHAPE`
  - **Severity**: FAIL
  - **Autofix**: NO

- **VAL-AECS-010**:
  - **Input(s)**: envelope JSON
  - **Rule**: `trace.traceId` is present and non-empty
  - **Fail message**: `AECS_MISSING_TRACE_ID`
  - **Severity**: FAIL
  - **Autofix**: NO

- **VAL-AECS-050**:
  - **Input(s)**: envelope JSON + approval token verifier
  - **Rule**: if classification is RESTRICTED, `approvalToken` must be present and verify with required claims
  - **Fail message**: `AECS_RESTRICTED_APPROVAL_TOKEN_MISSING_OR_INVALID`
  - **Severity**: FAIL
  - **Autofix**: NO

## 6. Test vectors

### 6.1 Missing trace ID

- **Given**: envelope missing `trace.traceId`
- **When**: envelope validation runs
- **Then**: FAIL with `AECS_MISSING_TRACE_ID`

### 6.2 RESTRICTED execution without approval token

- **Given**: envelope with `classification = RESTRICTED` and no `approvalToken`
- **When**: execution attempted
- **Then**: execution is blocked and audit evidence records the block

### 6.3 Token bound to wrong initiator

- **Given**: approval token claim `initiator.subjectId = user:bob` but envelope initiator is `user:alice`
- **When**: execution attempted
- **Then**: FAIL with `AECS_RESTRICTED_APPROVAL_TOKEN_MISSING_OR_INVALID`

## 7. Examples (non-normative)

Capability execute envelope (illustrative):

```json
{
  "capabilityId": "golden.echo",
  "initiator": { "subjectId": "user:alice", "roles": ["standard-user"] },
  "trace": { "traceId": "trace-123" },
  "classification": "INTERNAL",
  "costCenter": "CC-1024",
  "goldenContext": { "app_id": "golden.echo", "trace_id": "trace-123" },
  "input": { "x": 1 }
}
```

## 8. Changelog

### 1.0.0

- Initial canonical envelope shapes for initiator/trace/approval token and evidence requirements.

## Appendix A: Compatibility and migration (normative)

AECS-001 defines the *target* canonical envelope. The current Harmony runtime contains legacy shapes (e.g., capability execution inputs with `capId`, `runAs`, `traceId`, `ctx`). To avoid “spec says MUST NOT” contradicting current platform behavior, AECS adopts the following migration stance:

- **REQ-AECS-COMPAT-001**: Runners/consumers SHOULD accept both the canonical envelope fields and known legacy aliases during the migration window.
- **REQ-AECS-COMPAT-002**: Producers of new code MUST emit canonical AECS fields.
- **REQ-AECS-COMPAT-003**: When legacy aliases are observed, certification MUST emit WARN evidence until the deprecation EOL defined under VCS-001.

### Known legacy alias mapping (non-exhaustive, to be expanded during Phase-2 enforcement)

| Canonical (AECS) | Legacy alias (current runtime) |
| --- | --- |
| `capabilityId` | `capId` |
| `initiator.subjectId` | `runAs` or `initiatorId` |
| `trace.traceId` | `traceId` |
| `goldenContext` | `ctx` |

## Appendix B: Canonical field mapping table (normative)

To prevent alias drift across standards, the following mapping is canonical. Producers MUST emit the canonical form; adapters MAY map legacy fields to canonical during migration (Appendix A).

### Classification fields

| Surface | Field name |
| --- | --- |
| OCS capability | `security.dataClassification` |
| WCS blueprint descriptor (BDS) | `security.classification` |
| MCP manifest | `data_classification` |
| AECS envelope | `classification` |

### Initiator/identity fields

| Surface | Field name |
| --- | --- |
| AECS envelope | `initiator.subjectId` (+ `initiator.roles`) |
| AIP shared state (common memory) | `initiatorId` (legacy naming in AIP state; map to/from AECS `initiator.subjectId`) |
| MCP call envelope | `initiatorId` (map to/from AECS `initiator.subjectId`) |


