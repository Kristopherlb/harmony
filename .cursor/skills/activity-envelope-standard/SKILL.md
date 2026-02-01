---
name: activity-envelope-standard
description: Apply AECS-001 to standardize execution envelopes (initiator/trace/policy context/approval token) for capabilities and blueprints.
---

## Activity Envelope & Execution Contract Standard (AECS-001)

Use this skill when implementing or auditing tool execution paths (Temporal activities, blueprint runners, MCP tool surface) so envelope semantics are consistent and auditable.

### When to Use

- Designing capability execution activities and their inputs/outputs
- Designing blueprint runners and their invocation inputs/outputs
- Implementing RESTRICTED approval gating
- Adding certification evidence for authn/authz and policy enforcement

### Instructions

1. **Use canonical keys**: `initiator`, `trace`, `capabilityId`/`blueprintId`, `input`, `config`, `classification`, `costCenter`, `goldenContext`.
2. **Block aliases**: do not introduce `runAs`, `initiatorId` at top-level, or other ambiguous alternatives.
3. **Gate RESTRICTED** with `approvalToken` and bind it to toolId + initiator + trace + expiry.
4. **Emit evidence** for certification (validation occurred, identity propagated, approval verified, secrets handled per ISS-001).

See `references/activity-envelope-standard.md` for the normative specification.

