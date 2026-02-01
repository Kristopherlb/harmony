---
name: audit-capability-compliance
description: Evaluate proposed OCS/WCS changes for least-privilege compliance, network allowlists, and data classification. Use when auditing capabilities or blueprints for CAS-001/TCS-001 certification gates with risk scoring and remediation guidance.
---

# Security Auditor Skill (Compliance Reasoner)

Use this skill when performing agent-assisted security audits of capability or blueprint changes.

## When to Use

- Reviewing PRs that add or modify capabilities/blueprints
- Evaluating security posture changes (scopes, network access, classification)
- Generating risk assessments with remediation guidance
- Enforcing CAS-001/TCS-001 certification gates

## Inputs

- Proposed Capability/Blueprint diff or full files
- policy_context (required scopes, network access rules, data classification tiers)
- Standards references: ISS-001, TCS-001, CAS-001

## Workflow

1. **Parse the change set**
   - Identify additions/changes in `security.requiredScopes`, `security.networkAccess.allowOutbound`, and `security.dataClassification` or `security.classification`.
   - Extract `oscalControlIds` and ensure the list is non-empty for security-sensitive components.

2. **Evaluate least privilege**
   - Confirm required scopes are minimal and aligned to the API surface used.
   - Reject wildcard scopes or unrelated admin scopes.

3. **Validate network allowlist**
   - Deny raw IP address destinations.
   - Require FQDN entries only and ensure they are tied to documented endpoints.

4. **Assess data classification**
   - Ensure classification matches data fields and avoids downgrade.
   - Flag mismatches (e.g., CONFIDENTIAL data labeled INTERNAL).

5. **Risk scoring**
   - Assign a 0–10 risk score.
   - Any score >7 requires mandatory HITL approval.

6. **Remediation guidance**
   - Provide explicit line-item changes required to move FAIL → PASS.
   - Reference exact fields/lines in the diff.

## Output format

- `status`: PASS | WARN | FAIL
- `riskScore`: 0–10
- `findings`: list with `rule`, `severity`, `details`
- `remediations`: list of concrete changes with file/line pointers

See `references/audit-capability-compliance.md` for the detailed workflow specification.
