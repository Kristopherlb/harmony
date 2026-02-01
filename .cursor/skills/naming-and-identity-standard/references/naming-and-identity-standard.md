<!-- path: .cursor/skills/naming-and-identity-standard/references/naming-and-identity-standard.md -->

# Naming & Identity Standard (NIS-001)

| Metadata | Value |
| --- | --- |
| ID | NIS-001 |
| Version | 1.0.0 |
| Status | DRAFT |
| Authors | Platform Engineering |
| Context | OCS/WCS identity, Nx generators, deterministic discovery |

## 1. Scope

This standard defines **authoritative identity surfaces** and **deterministic transforms** for IDs, file paths, export symbols, registries, and MCP tool names.

- **In scope**: Capabilities, Blueprints (including descriptors), Agents (reasoners), registries, MCP manifests/tool surface, generator outputs.
- **Out of scope**: external vendor identifiers (they must be mapped into NIS surfaces).

## 2. Terms

- **Artifact**: A Capability, Blueprint, Agent, or other unit exposed to discovery.
- **Canonical ID**: The authoritative identity string for an artifact. This is always `metadata.id`.
- **Registry key**: The key under which an artifact is stored in an in-process registry map.
- **Tool name**: The name used by MCP `tools/list` and `tools/call`.
- **Derived surface**: A name/path derived deterministically from the canonical ID.
- **Namespace**: The prefix component of an ID (e.g., `golden.*`, `workflows.*`).

## 3. Normative language

This document uses MUST/SHOULD/MAY as defined in NST-001.

## 4. Normative requirements

### 4.1 Authoritative surfaces

- **REQ-NIS-001**: Every artifact MUST declare a `metadata.id` and it MUST be globally unique across all artifact types exposed to discovery.
- **REQ-NIS-002**: `metadata.id` is the canonical ID. All other identity surfaces are derived from it.
- **REQ-NIS-003**: The registry key MUST equal `metadata.id`.
- **REQ-NIS-004**: The MCP tool name MUST equal `metadata.id`.

### 4.2 Reserved namespaces

- **REQ-NIS-010**: Reserved namespaces MUST be defined and enforced by generators and audits.
- **REQ-NIS-011**: At minimum, the following namespaces are reserved:
  - `golden.*` (platform/demo capabilities)
  - `workflows.*` (blueprints)
  - `agents.*` (agents/reasoners)

### 4.3 ID format

- **REQ-NIS-020**: IDs MUST use lowercase ASCII letters, digits, and dot separators: `^[a-z0-9]+(\\.[a-z0-9]+)*$`, **unless allowlisted as legacy** per REQ-NIS-022.
- **REQ-NIS-021**: Underscores are disallowed in new IDs.
- **REQ-NIS-022**: Legacy IDs containing underscores MAY exist only if:
  - the ID appears in an explicit legacy allowlist, and
  - the allowlist entry includes a migration target ID and a migration status.

**Legacy allowlist (normative)**

- **REQ-NIS-023**: The legacy allowlist MUST live at `policies/nis-legacy-id-allowlist.json` (repo-relative).
- **REQ-NIS-024**: The allowlist format MUST be:

```json
{
  "$schema": "policies/nis-legacy-id-allowlist.schema.json",
  "ids": [
    {
      "legacyId": "workflows.math_pipeline",
      "targetId": "workflows.math.pipeline",
      "status": "PLANNED"
    }
  ]
}
```

### 4.4 Deterministic transforms (ID → derived)

- **REQ-NIS-030**: Each artifact type MUST define a single deterministic transform from `metadata.id` to:
  - file path(s)
  - exported symbol names
  - generator “name” input (where applicable)
- **REQ-NIS-031**: Transforms MUST be reversible or auditable (i.e., a checker can reconcile derived surfaces back to canonical IDs).

### 4.5 Stability and ordering

- **REQ-NIS-040**: Registries and manifests MUST be deterministically ordered (sort by `metadata.id`).
- **REQ-NIS-041**: Audits MUST fail on duplicates and MUST identify the colliding surfaces (file path, export, registry key, manifest entry).

### 4.6 Experimental/internal IDs

- **REQ-NIS-050**: If an “experimental” mechanism exists (suffix, prefix, or tag), it MUST be explicitly defined and enforced by audit.
- **REQ-NIS-051**: Experimental IDs MUST never collide with stable IDs and MUST not be published as stable MCP tools unless explicitly allowed by policy.

## 5. Validation rules

- **VAL-NIS-001**:
  - **Input(s)**: All discovered artifacts (capabilities + blueprints + agents).
  - **Rule**: All `metadata.id` values are unique (global).
  - **Fail message**: `NIS_ID_NOT_UNIQUE`
  - **Severity**: FAIL
  - **Autofix**: NO

- **VAL-NIS-010**:
  - **Input(s)**: All `metadata.id` values.
  - **Rule**: Every ID matches `^[a-z0-9]+(\\.[a-z0-9]+)*$` **or** is present in the legacy allowlist (REQ-NIS-022).
  - **Fail message**: `NIS_ID_INVALID_FORMAT`
  - **Severity**: FAIL
  - **Autofix**: NO

- **VAL-NIS-011**:
  - **Input(s)**: All `metadata.id` values.
  - **Rule**: If an ID contains `_`, it MUST appear in the legacy allowlist.
  - **Fail message**: `NIS_ID_UNDERSCORE_NOT_ALLOWED`
  - **Severity**: FAIL
  - **Autofix**: NO

- **VAL-NIS-012**:
  - **Input(s)**: All `metadata.id` values + legacy allowlist.
  - **Rule**: If an ID is present in the legacy allowlist, emit a legacy warning until migration completes.
  - **Fail message**: `NIS_LEGACY_ID_PRESENT`
  - **Severity**: WARN
  - **Autofix**: NO

- **VAL-NIS-020**:
  - **Input(s)**: registries and MCP manifest.
  - **Rule**: Registry keys and tool names equal `metadata.id`.
  - **Fail message**: `NIS_CANONICAL_ID_SURFACE_MISMATCH`
  - **Severity**: FAIL
  - **Autofix**: YES (generators/sync may rewrite registries/manifests deterministically)

## 6. Test vectors

### 6.1 Capability ID derivation from generator name (golden demo)

- **Given**:
  - Generator input name `jira-get-issue`
  - Canonical ID `golden.jira.get.issue`
- **When**: NIS transform validation runs
- **Then**: PASS; derived tool name equals canonical ID and registry key equals canonical ID

### 6.2 Legacy underscore allowlist

- **Given**:
  - Existing blueprint ID `workflows.math_pipeline`
  - Legacy allowlist contains `workflows.math_pipeline`
  - Migration plan target ID `workflows.math.pipeline`
- **When**: NIS audit runs
- **Then**: PASS with WARN `NIS_LEGACY_ID_PRESENT` until migration completes

### 6.3 Duplicate IDs across capability + blueprint

- **Given**:
  - Capability `metadata.id = workflows.echo`
  - Blueprint `metadata.id = workflows.echo`
- **When**: global uniqueness audit runs
- **Then**: FAIL with `NIS_ID_NOT_UNIQUE`

## 7. Examples (non-normative)

- Canonical: `workflows.hr.onboard`
- Canonical: `golden.echo`
- Not allowed (new): `workflows.math_pipeline` (underscore)
- Not allowed: `Workflows.Echo` (uppercase)
- Not allowed: `workflows.echo.v1` (version belongs in `metadata.version`, not the ID)

## 8. Changelog

### 1.0.0

- Initial definition of authoritative surfaces, reserved namespaces, format rules, and underscore migration policy.

