<!-- path: .cursor/skills/certification-and-audit/references/certification-and-audit.md -->

# Certification & Audit Standard (CAS-001)

| Metadata | Value |
| --- | --- |
| ID | CAS-001 |
| Version | 1.0.0 |
| Status | DRAFT |
| Authors | Platform QA + Platform Engineering + Platform Security |
| Context | Self-auditing gates (TCS) + deterministic certification report |

## 1. Scope

This standard defines the **certification surface** (checks) and the **certification report artifact**.

- **In scope**: audit categories, required evidence, PASS/FAIL semantics, report schema, deterministic output path.
- **Out of scope**: CI system configuration, artifact upload, signing (postponed for MVP).

## 2. Terms

- **Certification**: An automated run producing PASS/FAIL and a machine-readable report.
- **Audit**: A specific check that may PASS/FAIL/WARN with evidence.
- **Evidence**: Structured details supporting an audit result.
- **Report**: The final `CERTIFICATION.json` output.

## 3. Normative language

This document uses MUST/SHOULD/MAY as defined in NST-001.

## 4. Normative requirements

### 4.1 Required audit categories

- **REQ-CAS-001**: Certification MUST include audits for:
  - **Identity & naming** (NIS-001)
  - **Versioning & deprecations** (VCS-001)
  - **Capability compliance** (OCS + TCS contract verification)
  - **Blueprint compliance** (WCS + BDS-001)
  - **Envelope semantics** (AECS-001)
  - **Classification semantics** (CSS-001)
  - **Observability semantics** (GOS-001)
  - **Secrets policy** (ISS-001: keys only, redaction)

### 4.2 PASS/FAIL semantics

- **REQ-CAS-010**: Any FAIL-level audit MUST set overall certification `status = FAIL`.
- **REQ-CAS-011**: WARN-level audits MUST not fail certification but MUST be reported.

### 4.3 Deterministic report output

- **REQ-CAS-020**: Certification MUST output a single JSON file at:
  - `dist/certification/CERTIFICATION.json`
- **REQ-CAS-021**: The report MUST include:
  - `$schema` (report schema reference)
  - `specVersion` (CAS version)
  - `generatedAt` (ISO timestamp; deterministically derived as defined below)
  - `gitSha` (source revision)
  - `status` (`PASS | FAIL`)
  - `audits[]` (stable ordering)
- **REQ-CAS-022**: Collections MUST be deterministically ordered (sort by `metadata.id` and then by audit id).

- **REQ-CAS-023**: `generatedAt` MUST be deterministic for a given source revision.
  - The certifier MUST derive `generatedAt` from `SOURCE_DATE_EPOCH` (if set; unix seconds).
  - If `SOURCE_DATE_EPOCH` is not set, the certifier MUST derive `generatedAt` from the commit timestamp associated with `gitSha`.
  - If neither source of time is available, the certifier MUST set `generatedAt` to `1970-01-01T00:00:00.000Z`.

### 4.4 Evidence requirements (threat model hooks)

- **REQ-CAS-030**: Certification MUST include evidence that:
  - RESTRICTED tool gating is enforced (AECS-001 approval token)
  - identity propagation is present (initiator + trace)
  - secret schemas never accept raw secret values (ISS-001)
  - outbound allowlists exist for capabilities (OCS)

## 5. Validation rules

- **VAL-CAS-001**:
  - **Input(s)**: certification report JSON
  - **Rule**: report includes required fields and `audits` is deterministically ordered
  - **Fail message**: `CAS_REPORT_INVALID_OR_NONDETERMINISTIC`
  - **Severity**: FAIL
  - **Autofix**: NO

- **VAL-CAS-010**:
  - **Input(s)**: audit results
  - **Rule**: if any audit FAIL, `status` must be FAIL
  - **Fail message**: `CAS_STATUS_INCONSISTENT_WITH_AUDITS`
  - **Severity**: FAIL
  - **Autofix**: YES

## 6. Test vectors

### 6.1 FAIL propagates to overall status

- **Given**: audits include one FAIL
- **When**: report is produced
- **Then**: `status = FAIL`

### 6.2 Deterministic ordering

- **Given**: two runs with identical inputs (same `gitSha` and same `SOURCE_DATE_EPOCH` behavior), but different filesystem ordering
- **When**: report is produced
- **Then**: byte-for-byte identical `CERTIFICATION.json`

### 6.3 RESTRICTED gating evidence

- **Given**: RESTRICTED tool exists in manifest
- **When**: certification runs
- **Then**: report includes PASS evidence that AECS-001 gating is active (no token → blocked)

## 7. Examples (non-normative)

Illustrative report shape:

```json
{
  "$schema": "schemas/CERTIFICATION.schema.json",
  "specVersion": "1.0.0",
  "generatedAt": "2026-01-30T00:00:00.000Z",
  "gitSha": "abc123",
  "status": "PASS",
  "audits": [
    { "id": "NIS-001", "status": "PASS", "evidence": {} },
    { "id": "CSS-001", "status": "WARN", "evidence": { "items": [] } }
  ]
}
```

## 8. Changelog

### 1.0.0

- Initial certification surface and deterministic report requirements (unsigned).

