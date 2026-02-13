# Checkpoint: Engine MVP blue/green deploy hardening

**Date:** 2026-02-09  
**Milestone:** bluegreen-hardening  

## Progress
- [x] Added deterministic composition tests for `blueprints.deploy.blue-green`.
- [x] Verified `kubeconfigSecretRef` flows through `secretRefs` to:
  - `golden.flags.flagd-sync`
  - `golden.k8s.apply` (apply + compensation)
- [x] Improved compensation coverage by registering best-effort K8s rollback compensation **before** apply, so partial apply failures still trigger rollback.

## Artifacts changed/added
- `packages/blueprints/src/workflows/deploy/blue-green-deploy.workflow.test.ts`
- `packages/blueprints/src/workflows/deploy/blue-green-deploy.workflow.ts`

## Learnings
- Register compensations *before* potentially-failing mutating steps to cover partial-failure modes.

## Proposed plan updates (copy/paste ready)
- In “Blue/Green hardening” milestone, explicitly require a test that fails mid-apply and asserts compensations fire.

