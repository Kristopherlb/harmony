# Checkpoint: Baseline `openbao-least-priv`

**Date:** 2026-02-10  
**Scope:** staging least-priv OpenBao posture (AppRole) + preserve local dev defaults  

## Progress

- [x] Worker secretRef resolver supports AppRole auth (login + cached client token)
- [x] Console GitHub webhook ingress supports AppRole auth for OpenBao reads
- [x] Added a staging runbook for least-priv OpenBao posture + example policy

## Validation performed

- **Contract/tests**:
  - `packages/blueprints/src/worker/secret-broker.test.ts` (added AppRole test + cache assertion)
  - `packages/apps/console/server/http/github-webhook-router.test.ts` (added AppRole path test)
- **Local runtime**: not executed (requires real OpenBao AppRole setup)
- **Staging runtime**: not executed (requires real staging OpenBao)

## Learnings

- AppRole is a good fit for staging because it eliminates distributing long-lived root/dev tokens while still supporting deterministic secretRef reads.
- Token caching should be lease-aware and keyed conservatively (address + kv mount + auth mount + roleId).

## Friction

- Secret reading existed in multiple places (Console ingress + worker secret broker), so introducing AppRole required changes in both surfaces to avoid drift.

## Follow-ups

- Wire the staging env to use `BAO_ROLE_ID`/`BAO_SECRET_ID` and validate with:
  - `runbooks/release-staging-validation.md`
  - `runbooks/deploy-staging-validation.md`

## Plan alignment

- **Drift**: “execute a real staging run” is blocked until staging OpenBao AppRole and policies are provisioned.
- **Proposed plan updates (copy/paste)**:
  - Add an explicit “staging prerequisite” step: provision OpenBao AppRole + policy for the exact ISS-001 secret paths used by release+deploy.

