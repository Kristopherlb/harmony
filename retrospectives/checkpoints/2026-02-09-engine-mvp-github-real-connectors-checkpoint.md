# Checkpoint: Engine MVP GitHub real connectors

**Date:** 2026-02-09  
**Milestone:** github-real-connectors  

## Progress
- [x] Replaced placeholder GitHub REST + GraphQL capabilities with a real HTTP runtime embedded in the Dagger container.
- [x] Enforced default-deny outbound access via `security.networkAccess.allowOutbound` (fails fast without outbound attempt).
- [x] Added deterministic runtime contract tests (VM) that validate headers, URL construction, and allowOutbound behavior.

## Artifacts changed/added
- `packages/capabilities/src/connectors/github-runtime.ts`
- `packages/capabilities/src/connectors/github-runtime.test.ts`
- `packages/capabilities/src/connectors/github-rest-request.capability.ts`
- `packages/capabilities/src/connectors/github-rest-request.capability.test.ts`
- `packages/capabilities/src/connectors/github-graphql-query.capability.ts`
- `packages/capabilities/src/connectors/github-graphql-query.capability.test.ts`

## Learnings
- The “runtime script + VM tests” pattern (used by Jira) works well for deterministic integration validation without requiring Docker.

## Friction
- None significant beyond updating placeholder tests (env-token → secretRefs).

## Proposed plan updates (copy/paste ready)
- Clarify “deterministic integration tests” as “runtime-script contract tests (VM) + optional container smoke”.

