# Checkpoint: Baseline `devex-interop-guardrails`

**Date:** 2026-02-10  
**Scope:** prevent future Console server ESM interop regressions via targeted guardrails + codemod  

## Progress

- [x] Added a **Console-specific guardrail** target to detect default imports from `@golden/*`
- [x] Added a **codemod** to rewrite default imports → namespace imports in Console server

## Artifacts added/changed

- `tools/scripts/check-console-workspace-imports.mjs`
  - AST-based scan (TypeScript compiler API) over `packages/apps/console/server`
  - fails if it finds `import foo from '@golden/...';`
  - prints actionable JSON + points to codemod
- `tools/codemods/console-fix-golden-default-imports.mjs`
  - rewrites default imports from `@golden/*` into `import * as foo from '@golden/foo'`
  - supports `--check` mode
- `packages/apps/console/project.json`
  - new Nx target: `console:lint-interop` → runs the guardrail script

## Validation performed

- `pnpm nx run console:lint-interop` (passes)
- `node tools/codemods/console-fix-golden-default-imports.mjs --check` (reports 0 changes needed)

## Learnings

- A **narrow, deterministic guardrail** is more reliable than trying to run “full lint” in a codebase where TypeScript/ESLint strictness may intentionally vary across areas.

## Plan alignment

- **Drift**: none; this directly addresses the “interop churn” risk.
- **Proposed plan updates (copy/paste)**:
  - Add `pnpm nx run console:lint-interop` as a lightweight CI gate for Console server changes.

