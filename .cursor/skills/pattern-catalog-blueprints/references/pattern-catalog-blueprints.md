<!-- path: .cursor/skills/pattern-catalog-blueprints/references/pattern-catalog-blueprints.md -->

# Blueprint Pattern Catalog (BPC-001)

| Metadata | Value |
| --- | --- |
| ID | BPC-001 |
| Version | 1.0.0 |
| Status | DRAFT |
| Authors | Platform Engineering |
| Context | Repeatable orchestration patterns for WCS Blueprints |

## 1. Scope

Defines repeatable blueprint patterns and their required WCS/TCS baselines.

## 2. Patterns (baselines)

### 2.1 Pipeline

- Sequential steps; output of step N feeds step N+1.
- MUST add compensation after each mutating step (design-compensation-strategy).
- MUST test: happy path + fail at each step triggers LIFO compensations (TCS).

### 2.2 Fan-out / fan-in

- Parallelizable steps run concurrently; aggregate results at end.
- MUST ensure inputs are deterministically derived (no reliance on execution ordering).
- MUST test: concurrency does not change outputs.

### 2.3 Saga orchestration

- Long-running transactional workflow with compensations.
- MUST register compensations in LIFO order; MUST run on failure.
- MUST avoid polling loops (WCS APS rule).

### 2.4 Signal / wait (event-driven)

- Workflow waits on signals or long-poll activities rather than loops.
- MUST include timeouts per SLA.
- MUST test: waiting behavior is deterministic under replay.

### 2.5 Human-in-the-loop approval

- MUST define explicit HITL points (ASS/AIP), especially for RESTRICTED classification (CSS/AECS).
- MUST include evidence in certification (CAS).

### 2.6 Batching / APS-aware design

- MUST batch high-volume operations in activities.
- SHOULD bound APS via rate limits and chunk sizes.

## 3. Changelog

### 1.0.0

- Initial blueprint pattern catalog.

