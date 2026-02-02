---
name: incident-lifecycle
description: Implement and operate the incident lifecycle blueprint suite (initiate → remediate → close-out → post-mortem) with deterministic WCS patterns, HITL approvals, and discoverability hygiene.
---

# Incident Lifecycle (IL-001)

Use this skill when implementing or operating Harmony’s incident lifecycle automation suite.

## Scope

This skill covers:
- The **four incident blueprints** in `packages/blueprints/src/workflows/incident/`
- How to use **runbooks** via `golden.operations.runme-runner`
- How to create **post-mortems** via Confluence templates
- How to keep **discoverability deterministic** (tool catalog + registries)

## Blueprints

### `blueprints.incident.initiate`

- **Purpose**: Announce incident in Slack and optionally create PagerDuty/Statuspage incidents.
- **Implementation**: `packages/blueprints/src/workflows/incident/incident-initiate.workflow.ts`

### `blueprints.incident.remediate`

- **Purpose**: Request approval, then execute a remediation runbook (Runme), optionally with kubectl.
- **Implementation**: `packages/blueprints/src/workflows/incident/incident-remediate.workflow.ts`

### `blueprints.incident.close-out`

- **Purpose**: Request approval, resolve Statuspage/PagerDuty incidents (if correlation IDs exist), and post a close-out summary.
- **Implementation**: `packages/blueprints/src/workflows/incident/incident-close-out.workflow.ts`

### `blueprints.incident.post-mortem`

- **Purpose**: Request approval and create a Confluence post-mortem page, then post the link to Slack.
- **Implementation**: `packages/blueprints/src/workflows/incident/incident-post-mortem.workflow.ts`

## Runbooks (Runme)

Sample runbooks live in `/runbooks/` and are designed to be executed via:
- Capability ID: `golden.operations.runme-runner`

Included:
- `runbooks/api-health-check.md`
- `runbooks/redis-restart.md`
- `runbooks/database-connection-pool.md`
- `runbooks/clear-cache.md`
- `runbooks/rollback-deployment.md`

## Confluence Templates

Storage-format templates live in:
- `docs/incidents/templates/confluence/post-mortem.storage.html`
- `docs/incidents/templates/confluence/incident-update.storage.html`

Use them with:
- Capability ID: `golden.connectors.confluence`
- `bodyFormat: "storage"`

## Determinism + HITL Notes

- Workflows must remain deterministic (WCS-001):
  - Use `BaseBlueprint` wrappers (`this.now`, `this.uuid()`, `this.sleep()`) only.
  - Never do network I/O in workflow code; use capabilities.
- Approvals:
  - Use `BaseBlueprint.waitForApproval(...)` with `notifySlackChannel` when appropriate.
  - **Current limitation**: Slack interactive approvals currently send `approverRoles: []`.
    - If you set `requiredRoles`, Slack-driven approvals may be ignored until role mapping is implemented.

## Discoverability Hygiene (CDM-001)

After adding/updating capabilities or blueprints:

1. Preferred (one command):
   - `pnpm -w tools:regen-sync`
2. Equivalent manual steps:
   - `pnpm -w nx run mcp-server:generate-tool-catalog`
   - `pnpm -w nx g @golden/path:sync`

## Reference

- `docs/adr/ADR-002-incident-management.md`
- `docs/incidents/severity-definitions.md`
- `packages/core/src/wcs/approval-signal.ts`
- `packages/core/src/wcs/base-blueprint.ts`

