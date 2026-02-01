---
name: pattern-catalog-blueprints
description: Repeatable blueprint patterns (pipeline, fan-out, saga, signal-waiting, HITL approval, batching) and their required WCS/TCS baselines.
---

## Blueprint Pattern Catalog (BPC-001)

Use this skill to pick the right blueprint orchestration pattern and apply consistent WCS/TCS baselines.

### When to Use

- Designing a new blueprint workflow from a use case
- Converting an architecture plan into blueprint code
- Auditing a blueprint for APS-awareness, saga/compensation, and determinism

### Instructions

1. **Select a primary blueprint pattern** (pipeline, fan-out/fan-in, saga, signal/wait, HITL approval, batching).
2. **Apply WCS constraints**: determinism wrappers, ExecuteCapability activity usage, identity propagation, compensation LIFO.
3. **Apply TCS coverage**: acceptance tests, mock ExecuteCapability, failure-matrix for compensations.
4. **Declare governance metadata** in descriptors (BDS-001) for MCP exposure and audits.

