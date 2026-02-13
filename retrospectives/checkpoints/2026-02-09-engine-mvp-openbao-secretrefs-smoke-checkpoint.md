# Checkpoint: Engine MVP OpenBao secretRefs runtime smoke

**Date:** 2026-02-09  
**Milestone:** engine-openbao-smoke  

## Progress
- [x] Hardened `secretRefs` runtime behavior:
  - reject `..` traversal segments
  - redact OpenBao error bodies from thrown errors
- [x] Added a runtime smoke harness that writes a KV v2 secret and runs a real Dagger-executed capability via `executeDaggerCapability`.

## Artifacts changed/added
- `packages/blueprints/src/worker/secret-broker.ts`
- `packages/blueprints/src/worker/secret-broker.test.ts`
- `packages/capabilities/src/demo/secret-present.capability.ts`
- `packages/capabilities/src/demo/secret-present.capability.test.ts`
- `packages/blueprints/scripts/run-openbao-secretrefs-smoke.ts`
- `docs/dev/engine-mvp-core-capabilities.md`

## Learnings
- Tests-first hardening is cheap here: error redaction + traversal checks caught real leak risk (`res.text()` inclusion).

## Friction
- **Runtime smoke depends on Docker daemon**: `docker compose up` fails if Docker is not running, blocking the smoke on some environments.

## Proposed plan updates (copy/paste ready)
- Add an explicit “preflight” line before the smoke command:
  - “Ensure Docker Desktop/daemon is running and Dagger engine is available.”

