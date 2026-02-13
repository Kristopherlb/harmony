# Workbench Golden Path Agent Readiness

Purpose: make agent prerequisites explicit before implementation so milestone work does not fail on hidden environment assumptions.

Status: Approved for Milestone 0A
Last updated: 2026-02-11

---

## 1) Required Skills (must be loaded for this initiative)

Global skills:

- `/Users/kristopherbowles/.cursor/skills/test-driven-development/SKILL.md`
- `/Users/kristopherbowles/.cursor/skills/typescript-expert/SKILL.md`
- `/Users/kristopherbowles/.cursor/skills/clean-architecture/SKILL.md`

Project skills:

- `.cursor/skills/feature-golden-path/SKILL.md`
- `.cursor/skills/workbench-prompt-patterns/SKILL.md`
- `.cursor/skills/strategic-planning-protocol/SKILL.md`

Session startup requirements:

- `.cursor/skills/AGENT_STARTUP.md`
- `retrospectives/PATTERNS.md`

Execution rule:

- For behavior changes, follow Red -> Green -> Refactor and verify failing tests before production code changes.

---

## 2) MCP and Tool Access Assumptions

Required local tooling:

- Local repository with `pnpm` + `nx` test/build commands
- Console client/server test targets
- Deterministic regeneration commands (`pnpm tools:regen-sync`)
- Workbench telemetry smoke command (`pnpm telemetry:smoke:workbench -- --base-url <url>`)

Optional integrations (non-blocking for local milestones):

- GitHub resources and workflows (`gh`)
- Prometheus/Grafana surfaces for observability verification
- Temporal visibility external surfaces

Current fallback policy:

- If MCP resources are unavailable, continue with local deterministic checks and document pending external validation.
- Baseline checks MUST remain actionable with local endpoints and test suites.

---

## 3) Local Execution Prerequisites Checklist

- [ ] `pnpm install`
- [ ] Console starts: `pnpm nx serve console`
- [ ] Workbench route loads: `http://localhost:5000/workbench`
- [ ] Temporal stack (for run-path smoke): `pnpm nx run harmony:dev-up`
- [ ] Worker starts: `pnpm nx run harmony:dev-worker`
- [ ] Deterministic sync command runs: `pnpm tools:regen-sync`
- [ ] Workbench telemetry smoke runs: `pnpm telemetry:smoke:workbench -- --base-url http://localhost:3000`

---

## 4) Deterministic Validation Levels

- `contract`: schemas/specs/tests and generated artifacts are aligned
- `local_smoke`: local end-to-end behavior works with local dependencies
- `staging_smoke`: representative environment checks for real integrations

All milestone tasks must call out which level is achieved.

---

## 5) Known Friction and Preventive Checks

- Stale Workbench tool list after tool/catalog updates -> restart Console (`pnpm dev:console:restart`)
- Hidden artifact coupling for catalog/sync -> always run `pnpm tools:regen-sync` after capability/catalog changes
- Runtime smoke requiring Docker/Temporal -> preflight local daemon status before deeper debugging

