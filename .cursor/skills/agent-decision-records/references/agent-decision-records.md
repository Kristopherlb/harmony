<!-- path: .cursor/skills/agent-decision-records/references/agent-decision-records.md -->

# Agent Decision Records (ADR-AGENT-001)

| Metadata | Value |
| --- | --- |
| ID | ADR-AGENT-001 |
| Version | 1.0.0 |
| Status | DRAFT |
| Authors | Platform Intelligence + Platform Engineering |
| Context | AIP/ASS decision auditability |

## 1. Scope

Defines the canonical structure for recording agent decisions in a way that is auditable and can be used for certification evidence (CAS-001).

## 2. Decision record shape

Each decision record MUST follow this shape:

```json
{
  "id": "dec-001",
  "timestamp": "2026-01-30T00:00:00.000Z",
  "decisionType": "TOOL_SELECTION",
  "summary": "Use workflows.hr.onboard for employee onboarding",
  "constraintsApplied": {
    "classification": "CONFIDENTIAL",
    "requiredRoles": ["hr-admin"],
    "requiredScopes": ["hr:write"],
    "sla": { "targetDuration": "5m", "maxDuration": "1h" }
  },
  "alternatives": [
    { "option": "manualSteps", "rejectedBecause": "not durable and not auditable" }
  ],
  "approvalsRequired": [
    { "type": "RESTRICTED_APPROVAL", "toolId": "vendor.payroll.update" }
  ],
  "evidenceRefs": ["trace:trace-123"]
}
```

## 3. Storage in AIP shared state

- Decision records SHOULD be stored under a stable array key, e.g. `decision_records`.
- The record `id` MUST be unique within a workflow/session.

## 4. Changelog

### 1.0.0

- Initial decision record shape for agent auditability.

