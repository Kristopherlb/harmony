---
name: certification-and-audit
description: Apply CAS-001 to define certification gates and produce a deterministic CERTIFICATION.json report (unsigned in MVP).
---

## Certification & Audit Standard (CAS-001)

Use this skill when defining or implementing certification gates and the deterministic certification report artifact.

### When to Use

- Designing audit categories and PASS/FAIL semantics for Harmony artifacts
- Implementing `nx audit` / `nx certify` targets (later phase)
- Defining evidence requirements for security-sensitive behavior (RESTRICTED approvals, secrets, network allowlists)

### Instructions

1. **Include required audit categories** (identity, versioning, OCS/WCS compliance, envelope semantics, classification, observability, secrets).
2. **Define deterministic output**: write report to `dist/certification/CERTIFICATION.json`, stable ordering.
3. **Report semantics**: any FAIL ⇒ overall FAIL; WARNs are reported but don’t fail.
4. **Capture evidence** for threat model hooks without leaking secrets.

See `references/certification-and-audit.md` for the normative specification.

