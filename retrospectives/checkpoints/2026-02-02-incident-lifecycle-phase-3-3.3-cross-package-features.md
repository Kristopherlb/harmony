## Progress
- [x] Todo completed: Phase 3.3 — `cross-package-features` skill exists and is usable (skill + reference doc).

## Learnings
- A strict “lowest-layer contract first” ordering reduces churn when wiring Console + MCP + workflows together.
- Deterministic ordering and identity hygiene (`metadata.id` as the key everywhere) is the difference between stable catalogs and flaky ones.

## Friction
- It’s easy to accidentally export workflow-used code from the wrong `core` entrypoint (`index.ts` vs `wcs/workflow.ts`).
- Cross-package work is hard to review without a consistent “verification sequence” (unit → contract → boundary → wider).

## Opportunities
- Add a lightweight checklist to PR templates or review guidance for cross-package changes (exports, registry ordering, CDM/NIS metadata).
- Codify common cross-package wiring in generators (capability + registry + catalog sync scaffolding).

