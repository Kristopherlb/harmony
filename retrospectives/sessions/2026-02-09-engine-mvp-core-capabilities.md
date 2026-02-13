# Retrospective: Engine MVP core capabilities + workflow execution

**Date:** 2026-02-09  
**Scope:** prework inputs → OpenBao secretRefs smoke → GitHub connectors → GitHub-triggered release blueprint → blue/green hardening  

## What went well
- **TDD-first hardening**: secretRef traversal + redaction improvements landed with clear regression tests.
- **Deterministic runtime validation**: VM-based runtime contract tests for connector scripts gave confidence without requiring Docker.
- **Idempotent ingress**: GitHub webhook receiver uses a clean `deliveryId`-derived `workflowId` to make retries safe.

## What could be better
- **Runtime smoke prerequisites are brittle**: Docker daemon availability can block runtime-smoke validation.
- **Module interop gotcha**: default imports for workspace packages can be `undefined` in some TS/ESM/vitest contexts.

## Recommendations
### Immediate
- Add a `test` script to `@golden/blueprints` (alias to `vitest run`) to prevent `pnpm --filter @golden/blueprints test` confusion.
- Standardize workspace-package imports in Console server code: prefer `import * as pkg from '@golden/...';` for internal workspace packages.

### Near-term
- Add a preflight check in the OpenBao smoke script:
  - detect Docker daemon unreachable and emit a single actionable hint.

## Metrics (lightweight)
- New deterministic tests added in `@golden/capabilities`, `@golden/blueprints`, and Console server.
- One runtime-smoke harness added but not runnable without Docker daemon.

## Plan alignment (copy/paste-ready plan edits)
- Under the OpenBao runtime smoke milestone, add explicit prereqs:
  - “Docker daemon running”
  - “ENABLE_DAGGER_E2E=1”
- Under the GitHub-triggered ingress milestone, add required env inputs:
  - `GITHUB_WEBHOOK_SECRET_REF`
  - `GITHUB_TOKEN_SECRET_REF`
  - optional `GITHUB_RELEASE_BLUEPRINT_ID`

## Key takeaway
Deterministic tests + explicit secretRef safety rules let us move fast while keeping runtime claims honest.

