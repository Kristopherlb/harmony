---
name: audit-capability-compliance
description: Evaluate proposed OCS/WCS changes for least-privilege compliance, network allowlists, and data classification. Use when auditing capabilities or blueprints for CAS-001/TCS-001 certification gates with risk scoring and remediation guidance.
---

## Security Auditor Skill (Compliance Reasoner)

Use this skill when performing agent-assisted security audits of capability or blueprint changes.

### When to Use

- Reviewing PRs that add or modify capabilities/blueprints
- Evaluating security posture changes (scopes, network access, classification)
- Generating risk assessments with remediation guidance
- Enforcing CAS-001/TCS-001 certification gates

### Instructions

1. **Parse the change set** to identify security-relevant fields
2. **Evaluate least privilege** for required scopes
3. **Validate network allowlist** entries (FQDN only, no raw IPs)
4. **Assess data classification** for consistency
5. **Calculate risk score** (0–10, >7 requires HITL)
6. **Generate remediation guidance** with specific file/line references

See `references/audit-capability-compliance.md` for the detailed workflow specification.
