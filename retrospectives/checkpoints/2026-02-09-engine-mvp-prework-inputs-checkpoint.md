# Checkpoint: Engine MVP prework inputs

**Date:** 2026-02-09  
**Milestone:** prework-inputs  

## Progress
- [x] Documented MVP inputs + validation levels + acceptance criteria.
- [x] Pinned default OpenBao + GitHub assumptions used by the implementation.

## Artifacts changed/added
- `docs/dev/engine-mvp-core-capabilities.md`

## Key decisions
- **Validation levels**: Contract tests required; OpenBao runtime smoke required; staging/prod out of scope.
- **Webhook idempotency**: `workflowId = release-${deliveryId}`.
- **SecretRefs**: absolute path strings beginning with `/` (ISS-001 conventions).

## Friction observed
- None in this milestone; mostly documentation alignment.

## Proposed plan updates (copy/paste ready)
- Add a short “how to run smoke” snippet under Milestone 1 with Docker + Dagger prerequisites.

