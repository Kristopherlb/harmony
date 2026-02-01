---
name: unified-identity-model
description: Apply UIM-001 for Keycloak/OIDC role mapping, agent service accounts, and user context (cost center, clearance) in the Golden Path.
---

# Unified Identity Model (UIM-001)

Use this skill when mapping OCS scopes to Keycloak roles, defining agent service accounts, or consuming user attributes (division, clearance_level, cost_center) for RBAC and cost allocation.

## When to Use

- Mapping capability requiredScopes to Keycloak client roles (e.g., golden:jira:create_issue)
- Defining composite roles for workflows (e.g., onboarding-admin containing capability roles)
- Configuring agent identity (service accounts, client credentials, JWT claims with trace_id)
- Implementing or using Context Injector primitives with ID Token attributes

## Instructions

1. **Role mapping:** OCS scope maps 1:1 to Keycloak client role. Use naming golden:{provider}:{action}. Workflow-specific roles must be composite roles containing all required capability roles.
2. **Agents:** Each agent instance uses a dedicated Keycloak service account (e.g., agent-{namespace}-{agentId}). Use Client Credentials flow; embed trace_id in token custom claims for audit.
3. **User context:** Rely on standard ID Token attributes—division, clearance_level, cost_center—for cost allocation and data classification.

For the full normative standard, see **references/unified-identity-model.mdx**.
