# Checkpoint: Engine MVP GitHub-triggered release blueprint

**Date:** 2026-02-09  
**Milestone:** release-blueprint-github-trigger  

## Progress
- [x] Implemented `blueprints.ci.github-release` blueprint composing GitHub REST + GraphQL capabilities.
- [x] Added Console webhook ingress:
  - OpenBao-resolved signature secretRef validation for `X-Hub-Signature-256`
  - deterministic event envelope normalization
  - idempotent Temporal start: `workflowId = release-${deliveryId}` and 200-on-retry behavior

## Artifacts changed/added
- `packages/blueprints/src/workflows/ci/github-release.workflow.ts`
- `packages/blueprints/src/workflows/ci/github-release.workflow.test.ts`
- `packages/blueprints/src/workflows/ci/github-release.workflow-run.ts`
- `packages/blueprints/src/descriptors/github-release.descriptor.ts`
- `packages/blueprints/src/registry.ts`
- `packages/blueprints/src/workflows/index.ts`
- `packages/apps/console/server/http/github-webhook-router.ts`
- `packages/apps/console/server/http/github-webhook-router.test.ts`
- `packages/apps/console/server/routes.ts`

## Learnings
- For Console server code, prefer namespace imports for workspace packages (`import * as blueprints`) to avoid default-import interop pitfalls.

## Friction
- Default import interop: `import blueprints from '@golden/blueprints'` was `undefined` in this context and caused a 500 until corrected.

## Proposed plan updates (copy/paste ready)
- In ingress instructions, include required envs:
  - `GITHUB_WEBHOOK_SECRET_REF`
  - `GITHUB_TOKEN_SECRET_REF`
  - optional `GITHUB_RELEASE_BLUEPRINT_ID`

