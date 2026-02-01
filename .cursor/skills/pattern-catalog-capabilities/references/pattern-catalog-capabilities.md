<!-- path: .cursor/skills/pattern-catalog-capabilities/references/pattern-catalog-capabilities.md -->

# Capability Pattern Catalog (CPC-001)

| Metadata | Value |
| --- | --- |
| ID | CPC-001 |
| Version | 1.0.0 |
| Status | DRAFT |
| Authors | Platform Engineering |
| Context | Repeatable baselines for capability patterns |

## 1. Scope

Defines pattern baselines for capabilities so that generated code is consistent and auditable.

- **In scope**: connector/transformer/commander (+ future guardian/reasoner) baselines.
- **Out of scope**: vendor-specific API details.

## 2. Terms

- **Connector**: integrates external APIs; networked side effects occur at runtime (not in factory).
- **Transformer**: pure data transform; no network required.
- **Commander**: executes CLIs inside container; maps exit codes/errors deterministically.
- **Guardian**: policy enforcement capability (future).
- **Reasoner**: agent/graph capability (future; governed by ASS/AIP).

## 3. Normative requirements (pattern baselines)

### 3.1 Connector baseline

- MUST declare explicit `networkAccess.allowOutbound` (OCS).
- MUST define errorMap categories for common API failures (auth, rate limit, retryable).
- SHOULD include idempotency guidance (idempotency key in input schema).
- MUST include contract test validating example input/output against schemas (TCS).

### 3.2 Transformer baseline

- MUST not require network allowOutbound (empty is acceptable but must be explicit per OCS).
- MUST be deterministic and side-effect free (including runtime, where feasible).
- MUST include property-based style tests where practical (optional).

### 3.3 Commander baseline

- MUST map exit codes and stderr patterns to error categories deterministically.
- MUST explicitly pin container image/tool version.
- MUST include tests for mapping of common failure modes.

### 3.4 Guardian baseline (future)

- MUST be pure policy evaluation with explicit inputs and explainable outputs.
- MUST be auditable and produce structured evidence for CAS-001.

### 3.5 Reasoner baseline (future)

- MUST follow ASS-001 state schema + checkpointer.
- MUST invoke external side effects via MCP/OCS tools only (no hardcoded clients).

## 4. Test vectors

- Connector: 401 response maps to AUTH_FAILURE
- Commander: non-zero exit code maps to FATAL unless explicitly retryable
- Transformer: same input produces same output (determinism)

## 5. Changelog

### 1.0.0

- Initial pattern baselines.

