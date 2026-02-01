---
name: workflow-composition-standard
description: Apply WCS-001 when building or reviewing Temporal Blueprints, durable workflows, and MCP-exposed automations.
---

# Workflow Composition Standard (WCS-001)

Use this skill when implementing or auditing "Blueprints"—durable, deterministic workflows that orchestrate OCS Capabilities and are exposed as MCP tools.

## When to Use

- Implementing workflows that extend BaseBlueprint (Temporal)
- Enforcing determinism (time, randomness, sleep via base class only)
- Configuring RBAC, identity propagation, and data classification
- Designing Saga/compensation flows and MCP tool exposure
- Planning namespaces, batching, and APS (Actions Per Second) usage

## Instructions

1. **Structure:** All workflows must extend BaseBlueprint. Use the platform's ExecuteCapability activity; do not implement custom Temporal Activities for capability execution.
2. **Determinism:** Use only base class wrappers for time (`this.now()`), randomness (`this.uuid()`), and sleep (`this.sleep()`). No raw `Date`, `Math.random()`, or `setTimeout`.
3. **Security:** Declare `requiredRoles` (Keycloak); propagate InitiatorID via `runAs`; use client-side encryption for CONFIDENTIAL/RESTRICTED; require mTLS for workers.
4. **Saga:** Register compensations with `addCompensation`; execute in LIFO order on failure.
5. **Observability & cost:** Use automatic instrumentation (Golden Signals); declare `costCenter`; avoid polling loops—use Signals or long-poll activities.

For the full normative standard and BaseBlueprint contract, see **references/workflow-composition-standard.mdx**.
