## Progress
- [x] Todo completed: Phase 3.1 — `temporal-signals-and-queries` skill exists and is usable (skill + reference doc).

## Learnings
- Typed Signals/Queries + `condition()` waiting give a clean, deterministic alternative to polling for HITL and external triggers.
- Treating signal/query names as stable contracts is critical (they become part of the workflow API surface).

## Friction
- Easy to miss the “contracts are forever” implication if signal/query naming isn’t documented alongside the implementation.
- Multiple layers reference the same patterns (core + console handlers); without a skill, contributors reinvent payload shapes.

## Opportunities
- Add a small “contract checklist” section to related workflow/HITL docs (name stability, JSON-serializable payloads, handler purity).
- When adding new gates, standardize around a discriminated union for gate state to simplify query consumers.

