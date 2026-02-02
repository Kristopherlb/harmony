<!-- path: .cursor/skills/cross-package-features/references/cross-package-features.md -->

# Cross-Package Feature Delivery Standard (CPF-001)

| Metadata | Value |
| --- | --- |
| ID | CPF-001 |
| Version | 1.0.0 |
| Status | DRAFT |
| Authors | Platform Engineering |
| Context | Harmony monorepo feature coordination across packages |

## 1. Scope

This standard defines a deterministic, low-risk approach to implement features spanning:

- `packages/core`
- `packages/capabilities`
- `packages/blueprints`
- `packages/apps/console` (server + client)

Out of scope: CI configuration changes and broad refactors not required by the feature.

## 2. Principles

- **Lowest-layer ownership**: types/schemas live where the contract is owned.
- **Deterministic exposure**: registries, manifests, and catalogs must be stable and sortable.
- **Minimize coupling**: higher layers depend “down”; avoid cycles.
- **TDD-first**: prove behavior with failing tests before implementing production logic.

## 3. Recommended sequence (normative)

- **REQ-CPF-001**: Implement cross-package features in this order unless there is a documented exception:
  1) types/schemas
  2) core shared logic and exports
  3) capabilities and registry
  4) blueprint activities/orchestration
  5) server handlers/adapters
  6) client UI

Rationale: each step provides stable contracts to the next layer, minimizing rework.

## 4. Export surfaces

- **REQ-CPF-010**: Workflow-bundle-safe exports MUST be added to `packages/core/src/wcs/workflow.ts` (not `packages/core/src/index.ts`) when used by Temporal workflows.
- **REQ-CPF-011**: Node/app exports SHOULD be added to `packages/core/src/index.ts` when consumed by servers/clients.

## 5. Discovery and identity

- **REQ-CPF-020**: Canonical identity surfaces MUST follow NIS-001:
  - registry keys == `metadata.id`
  - MCP tool names == `metadata.id`
  - stable deterministic ordering by `metadata.id`

- **REQ-CPF-021**: Discovery metadata MUST follow CDM-001:
  - `metadata.domain` kebab-case
  - `metadata.tags` includes `metadata.domain`
  - `metadata.id` begins with `golden.` and its domain segment matches `metadata.domain`

## 6. Verification sequence (suggested)

Use existing scripts/targets where available; validate incrementally:

- unit tests in the package you changed
- contract tests for capabilities
- build the dependent packages that import the changed modules
- only then run broad workspace checks

Example sequence (illustrative):

- `pnpm nx test core`
- `pnpm nx test capabilities`
- `pnpm nx build capabilities`
- `pnpm nx test console-server`
- `pnpm nx test console-client`

## 7. Case studies (non-normative)

### 7.1 HITL approval wiring

- Core defines signal/query + Block Kit helpers: `packages/core/src/wcs/approval-signal.ts`
- Console server handles Slack callbacks: `packages/apps/console/server/integrations/http/slack-interactive-handler.ts`
- Workflows wait on signals and update status via activities (WCS-001)

### 7.2 Tool catalog + UI palette

- Capabilities registered in `packages/capabilities/src/registry.ts`
- MCP tool catalog served by Console and consumed in `useMcpTools`-style hooks
- UI groups by `domain/subdomain/tags` (CDM-001)

## 8. Changelog

### 1.0.0

- Initial cross-package sequencing and hygiene rules.

