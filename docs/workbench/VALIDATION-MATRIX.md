# Workbench Golden Path Validation Matrix

Status: Approved  
Scope: milestone-by-milestone validation levels and execution gates

Skills used:

- `.cursor/skills/feature-golden-path/SKILL.md`
- `test-driven-development`
- `.cursor/skills/strategic-planning-protocol/SKILL.md`

---

## Validation Levels

- `contract`: tests/specs/schemas/deterministic artifacts
- `local_smoke`: local end-to-end behavior checks
- `staging_smoke`: representative integration environment checks

---

## Matrix

| Milestone | Contract | Local Smoke | Staging Smoke | Exit Gate |
| --- | --- | --- | --- | --- |
| M0A Agent Readiness | Skills + prerequisites docs complete | Console/Workbench startup verified | N/A | Readiness checklist merged |
| M0A.1 Visibility | Status tracker fields complete | Tracker updates after milestone slice | N/A | Progress + risks + blockers + QA + next actions visible |
| M0A.2 Manual QA | Living guide includes all required flows | Run at least one end-to-end script from guide | N/A | QA guide updated in same PR as behavior changes |
| M0B Spec Pack | Core specs approved and linked | Spec constraints sanity-checked against existing endpoints | N/A | No blocker specs left in draft-only state |
| M0C Guardrails/Baseline | Validation commands documented | `/api/workbench/metrics` baseline captured locally | Optional | Baseline snapshot recorded |
| M1 Approval + Telemetry Parity | Approval contract tests and telemetry tests pass | Draft run emits start/completion parity and logs approval context | Optional | Approval API rejects contextless entries |
| M2 Tool Catalog Intelligence | `ai_hints` round-trip tests pass | `/api/mcp/tools` returns hints when present | Optional | Deterministic catalog updated and synced |
| M3 Intent Router | Intent classification tests pass | Discovery prompts do not force generation | Optional | Discovery misrouting regression tests green |
| M4 Recipe Registry | Recipe schema + deterministic selector tests pass | Seeded recipes selected for representative prompts | Optional | Stable ranking outputs for fixed fixtures |
| M5 Outcome Feedback | Scoring logic tests pass | Diagnostics explain selected path | Optional | Sparse telemetry fallback behavior verified |
| M6 End-User Golden Path | Guide/prompt contracts validated | Full startup -> generate -> run -> observe loop completed | Recommended | One complete and one failure-recovery cycle verified |
| M7 Blueprint-First Discovery Fidelity | Discovery contract tests + MCP gate tests pass | MCP Console gate + direct MCP handshake + propose/run smoke pass without canvas | Recommended | Discovery response uses catalog IDs; no-generation-on-discovery is enforced |

---

## Standard Command Set

Primary gates (run based on touched area):

- `pnpm nx run console:test-client-workbench`
- `pnpm -C packages/apps/console test:server`
- `pnpm -C packages/apps/console test:server:approval`
- `pnpm tools:regen-sync`
- `pnpm -w vitest run packages/tools/mcp-server/src/manifest/tool-catalog.test.ts`
- `pnpm telemetry:smoke:workbench -- --base-url http://localhost:3000`
- `pnpm --dir packages/apps/console exec vitest run server/blueprint-first-api-smoke.test.ts`
- `pnpm -w vitest run packages/tools/mcp-server/src/demo/stdio-jsonrpc-client.test.ts`

---

## Notes

- MCP readiness is a hard prerequisite for blueprint-first propose/run validation.
- Validation level achieved must be called out in milestone updates and PR notes.

