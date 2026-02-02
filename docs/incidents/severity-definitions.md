# SRE Incident Severity Definitions (P1–P4)

This document defines standard incident severities for SRE/on-call operations and how they map to response expectations and approval requirements.

These severities are also the canonical values used by Harmony incident workflows via `IncidentSeverity` (`P1`, `P2`, `P3`, `P4`) in `GoldenContext`.

---

### Severity matrix

| Severity | Response time | Examples | Approval required |
| --- | --- | --- | --- |
| **P1 - Critical** | Immediate (<15 min) | Complete outage, data loss, active security incident | **Auto-escalate.** No approval for *initial response* actions needed to stop the bleeding. Approval still required for **destructive/irreversible** actions when feasible. |
| **P2 - High** | < 1 hour | Major feature degraded, significant user impact | **HITL approval** required for destructive actions (e.g., rollback, failover, broad config changes). |
| **P3 - Medium** | < 4 hours | Minor feature issues, limited user impact | **HITL approval** required for changes (prefer “safe mode” mitigations and scoped interventions). |
| **P4 - Low** | < 24 hours | Cosmetic issues, documentation, low-risk operational tasks | **Standard approval flow** (may be automated if policy allows). |

---

### Approval-timeout defaults (workflow guidance)

Harmony’s incident automation commonly uses approval gates (signals/queries) for sensitive operations. Recommended approval wait time by severity:

| Severity | Default approval timeout |
| --- | --- |
| P1 | 5m |
| P2 | 15m |
| P3 | 30m |
| P4 | 1h |

These defaults align with `getApprovalTimeoutForSeverity(severity)` in `packages/core`.

---

### Practical guidance

- **Prefer reversibility**: choose mitigations that can be rolled back or scoped (feature flags, rate limits, partial rollouts) before destructive actions.
- **Escalate early for P1/P2**: involve Incident Commander and relevant service owners immediately; establish a dedicated incident channel.
- **Always record intent**: include a short reason for any approval request (especially rejections) to keep the audit trail actionable.
- **Use impacted services**: explicitly list impacted services when possible to avoid vague severity inflation.

