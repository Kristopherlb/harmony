---
name: agent-decision-records
description: Standardize agent decision records so tool selection, constraints, and HITL requirements are reviewable and auditable across AIP/ASS flows.
---

## Agent Decision Records (ADR-AGENT-001)

Use this skill to make agent decisions stable and auditable: what was chosen, why, what constraints were applied, and what approvals are required.

### When to Use

- Selecting tools (capabilities/blueprints) via MCP
- Choosing between alternative architectures or patterns
- Introducing RESTRICTED actions or HITL requirements
- Producing artifacts that an Ops/audit agent must review

### Instructions

1. **Create a decision record** for each irreversible or security-relevant decision.
2. **Pin constraints**: classification (CSS), roles/scopes (UIM/OCS), determinism constraints (WCS/DGS), and cost/SLA.
3. **Record alternatives** considered and why they were rejected.
4. **Record required approvals** explicitly (RESTRICTED gating per AECS/ASS).
5. **Attach decision records to shared state** (AIP) under a stable key.

See `references/agent-decision-records.md` for the canonical structure.

