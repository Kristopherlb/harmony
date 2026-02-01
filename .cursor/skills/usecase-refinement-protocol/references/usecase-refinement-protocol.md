<!-- path: .cursor/skills/usecase-refinement-protocol/references/usecase-refinement-protocol.md -->

# Use Case Refinement Protocol (URP-001)

| Metadata | Value |
| --- | --- |
| ID | URP-001 |
| Version | 1.0.0 |
| Status | DRAFT |
| Authors | Product + Platform Engineering |
| Context | Deterministic intake artifacts for architects/generators |

## 1. Scope

This protocol defines how to turn user intent into deterministic JSON artifacts that downstream skills and generators can consume without ambiguity.

- **In scope**: required intake artifacts and their minimal fields.
- **Out of scope**: UI/UX flows for intake collection.

## 2. Terms

- **Use case brief**: single-page structured summary of objective and constraints.
- **Acceptance tests**: scenario list aligned with TCS-001 testing intent (contract + behavior).
- **Capability gap analysis**: mapping from required steps → existing/missing capabilities with patterns and constraints.

## 3. Normative requirements

- **REQ-URP-001**: The protocol MUST output exactly three artifacts:
  - `usecase_brief.json`
  - `acceptance_tests.json`
  - `capability_gap_analysis.json`
- **REQ-URP-002**: Artifacts MUST be deterministic (stable key ordering by convention; stable array ordering by `id` or `name`).
- **REQ-URP-003**: The brief MUST include explicit classification per CSS-001 and explicit role/scope requirements per UIM/OCS.

## 4. Artifact shapes (minimum)

### 4.1 usecase_brief.json

```json
{
  "id": "usecase.hr.onboard_employee",
  "objective": "Onboard a new employee end-to-end",
  "nonGoals": ["Payroll setup"],
  "classification": "CONFIDENTIAL",
  "requiredRoles": ["hr-admin"],
  "requiredScopes": ["hr:write"],
  "sla": { "targetDuration": "5m", "maxDuration": "1h" },
  "hitl": { "required": true, "points": ["managerApproval"] },
  "network": { "allowOutbound": ["api.vendor.com"] }
}
```

### 4.2 acceptance_tests.json

```json
{
  "usecaseId": "usecase.hr.onboard_employee",
  "scenarios": [
    {
      "id": "happyPath",
      "input": { "employeeEmail": "alice@example.com" },
      "expected": { "status": "COMPLETED" }
    }
  ]
}
```

### 4.3 capability_gap_analysis.json

```json
{
  "usecaseId": "usecase.hr.onboard_employee",
  "steps": [
    {
      "id": "createUser",
      "pattern": "connector",
      "capabilityId": "vendor.identity.create_user",
      "exists": false,
      "classification": "CONFIDENTIAL",
      "requiredScopes": ["identity:write"],
      "allowOutbound": ["api.vendor.com"]
    }
  ]
}
```

## 5. Validation rules

- **VAL-URP-001**: All artifacts exist and `usecaseId`/`id` cross-reference correctly.
- **VAL-URP-010**: `classification` values conform to CSS-001 lattice.
- **VAL-URP-020**: Every step declares pattern and required policy fields (scopes, allowOutbound).

## 6. Changelog

### 1.0.0

- Initial intake protocol and minimal JSON shapes.

