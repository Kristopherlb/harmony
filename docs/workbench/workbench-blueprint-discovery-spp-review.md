# Workbench Blueprint Discovery SPP Persona Review

Date: 2026-02-11  
Plan reference: `~/.cursor/plans/blueprint_discovery_improvement_plan_55c0db36.plan.md`

## Scope

This review applies SPP-001 before and during execution of the assigned to-dos:

- `mcp-enable-gate`
- `discovery-contract`
- `blueprint-first-tests`
- `docs-and-validation`
- `spp-persona-review`
- `mandatory-retros`
- `mandatory-tdd`

## Persona Scorecard

| Persona | Score (1-10) | Readiness | Key gaps found | Mitigation applied |
| --- | --- | --- | --- | --- |
| Agent | 8.5 | Ready | Discovery turns could drift into generic advice | Added deterministic catalog-grounded discovery response with no-generation behavior |
| Developer | 8.0 | Ready | MCP verification was split across surfaces and easy to skip | Added single MCP readiness-gated smoke test for propose/run API path |
| End User | 8.0 | Ready | Discovery fidelity check was implicit in docs | Added explicit security-capability discovery fidelity check in operator QA docs |
| Leadership | 7.5 | Ready | Validation matrix did not call out MCP gate as hard prerequisite | Updated validation matrix to require MCP gate before blueprint-first flow |
| Domain Expert (Security Engineer) | 8.5 | Ready | Security capability discovery phrasing could be misrouted | Intent router now classifies security capability asks as discovery intent |

Average score: **8.1**  
Threshold check: **pass** (`>= 7.0`, no unresolved P0 blockers)

## Gap Mitigations (Execution-Coupled)

| Gap ID | Validation level | Mitigation | Evidence artifact |
| --- | --- | --- | --- |
| GAP-01: MCP gate inconsistency | `contract` + `local_smoke` | Added MCP readiness gate in blueprint-first smoke test (Console API + direct MCP handshake) | `packages/apps/console/server/blueprint-first-api-smoke.test.ts` |
| GAP-02: Discovery drift to non-catalog suggestions | `contract` | Added deterministic catalog-grounded discovery response with empty-catalog truth path | `packages/apps/console/server/services/openai-agent-service.ts` |
| GAP-03: Security discovery phrasing misrouting | `contract` | Expanded intent routing for security capability availability phrasing | `packages/apps/console/server/services/intent-router.ts` |
| GAP-04: Operator path lacked explicit fidelity checks | `local_smoke` | Updated Workbench docs and matrix with discovery fidelity steps and hard MCP gate | `docs/workbench/*.md`, `docs/dev/mcp-tools-refresh.md` |
| GAP-05: TDD/retro gates inconsistently evidenced | `contract` process gate | Added explicit RED->GREEN evidence in tests and checkpoint/session retros | `retrospectives/checkpoints/*`, `retrospectives/sessions/*` |

## Validation-Level Labeling

- `contract`: routing/discovery tests and deterministic response contract
- `local_smoke`: MCP gate + blueprint propose/run API smoke without canvas
- `staging_smoke`: deferred; requires deployed `harmony-mcp` service path verification

## Pre-Execution / Pre-Test Gate

Before blueprint-first generation/run tests:

1. `GET /api/mcp/tools` returns non-empty tools
2. `POST /api/mcp/tools/refresh` bumps `manifest.generated_at`
3. Direct MCP handshake passes (`initialize`, `tools/list`, `tools/call`)

If any step fails, stop blueprint tests and remediate MCP health first.
