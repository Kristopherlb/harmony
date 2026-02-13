# Improvement Tracker

Master list of improvement recommendations from retrospectives. Track implementation status and impact.

---

## Status Legend

- ⬜ **Proposed** — Identified but not started
- 🟨 **In Progress** — Currently being worked on
- ✅ **Implemented** — Done, monitoring impact
- ❌ **Declined** — Decided not to implement (with reason)
- 🗄️ **Archived** — No longer relevant

---

## Immediate (This Sprint)

| ID | Recommendation | Source | Status | Implemented |
|----|----------------|--------|--------|-------------|
| IMP-001 | Create `docs/adr/TEMPLATE.md` | OSCAL-2026-02-01 | ✅ | 2026-02-01 |
| IMP-002 | Add OSCAL vocabulary skill | OSCAL-2026-02-01 | ✅ | 2026-02-01 |
| IMP-003 | Document External CLI Wrapper pattern | OSCAL-2026-02-01 | ✅ | 2026-02-01 |
| IMP-010 | Seed minimal deterministic tool-catalog artifact in `@golden/path:sync` generator tests | DX-ARTIFACTS-2026-02-02 | ✅ | 2026-02-02 |
| IMP-011 | Make generator array options CLI-friendly (repeatable `--fields=name:type[:optional|required]`) | DX-ARTIFACTS-2026-02-02 | ✅ | 2026-02-02 |
| IMP-014 | Standardize Package Scaffolding (root `index.ts`) | OSCAL-2026-02-01 | ✅ | 2026-02-01 (Script: `tools/scripts/create-package.ts`) |
| IMP-020 | Enforce `retryPolicy` complete shape | Compliance-2026-02-02 | ✅ | 2026-02-02 (Extracted `RetryPolicy` interface) |
| IMP-021 | Lint rule/check for Shell vs TS string interpolation | Compliance-2026-02-02 | ✅ | 2026-02-02 (Added `no-restricted-syntax` rule) |
| IMP-023 | Add Kind-backed runtime smoke for dogfooding deploy (blue/green) | PHASE7-SHIPPING-2026-02-02 | ⬜ |  |
| IMP-024 | Standardize CI blueprint input passing (file/base64; avoid inline JSON quoting) | PHASE7-SHIPPING-2026-02-02 | ⬜ |  |
| IMP-029 | Add markdown rendering component for Console runbooks (safe subset) | INCIDENT-LIFECYCLE-P5-2026-02-02 | ✅ | 2026-02-02 |
| IMP-030 | Add incident-scoped approvals/executions query endpoints (eventId/incidentId/serviceTag) | INCIDENT-LIFECYCLE-P5-2026-02-02 | ✅ | 2026-02-02 |
| IMP-041 | Document Prometheus scrape endpoints for Console Workbench metrics (and where scrape configs live) | WORKBENCH-UX-P4.5-2026-02-02 | ⬜ |  |
| IMP-042 | Add Prometheus alert rules for Workbench SLOs (latency + acceptance + run success) | WORKBENCH-UX-P4.5-2026-02-02 | ⬜ |  |
| IMP-043 | Establish Playwright E2E harness + Tier‑0 Workbench spec (fixture-driven) | WORKBENCH-UX-P4.6-2026-02-02 | ✅ | 2026-02-09 |
| IMP-044 | Persist Workbench approval log (replace in-memory) + include actionable context (incidentId/workflowId) + real approver identity when available | WORKBENCH-UX-P4.6-2026-02-02 | ⬜ |  |
| IMP-045 | Add per-node execution state (Temporal history mapping or workflow query) to drive live canvas status per step | WORKBENCH-UX-P4.6-2026-02-02 | ⬜ |  |
| IMP-046 | Implement template confirmation flow for agent suggestions (templateId → UI “Load template?” → apply) | WORKBENCH-UX-P4.6-2026-02-02 | ✅ | 2026-02-02 |
| IMP-047 | Add a Workbench telemetry smoke script/runbook (post event → verify expected series in `/api/workbench/metrics`) | WORKBENCH-UX-P4.6-2026-02-02 | ⬜ |  |
| IMP-048 | Add fixture-driven agent eval harness + dedicated `test:evals` target for prompt/tool regression testing | WORKBENCH-UX-P4.6-2026-02-02 | ✅ | 2026-02-02 |
| IMP-049 | Add cost/budget UX plumbing: `/api/workbench/cost`, budgetKey override, and UI cost badges (Workbench + Account) | WORKBENCH-UX-P4.6-2026-02-02 | ✅ | 2026-02-02 |
| IMP-050 | Add a CI gate that runs Tier‑0 Playwright E2E (`pnpm e2e`) and uploads trace on failure | WORKBENCH-TIER0-2026-02-09 | ⬜ |  |
| IMP-051 | Add server-backed Account preferences API (replace localStorage) + authenticated “current user” identity source for budget keys | WORKBENCH-TIER0-2026-02-09 | ⬜ |  |
| IMP-052 | Extend tool exploration metadata to support multiple explorers per tool (e.g., OpenAPI + GraphQL) and show connection health from `/api/integrations/status` | WORKBENCH-TIER0-2026-02-09 | ⬜ |  |
| IMP-053 | Add per-run “cost estimate” UX in Workbench using tool `costFactor` + planned token budget before submit | WORKBENCH-TIER0-2026-02-09 | ⬜ |  |
| IMP-054 | Add `test` script to `@golden/blueprints` (alias to `vitest run`) to prevent false-success runs via missing script | ENGINE-MVP-2026-02-09 | ✅ | 2026-02-10 |
| IMP-055 | Standardize internal workspace package imports in Console server to namespace imports (avoid default-import interop pitfalls) | ENGINE-MVP-2026-02-09 | ✅ | 2026-02-10 |
| IMP-056 | Add CI gate for `pnpm nx run console:lint-interop` to prevent default-import regressions in Console server | BASELINE-ROADMAP-2026-02-10 | ⬜ |  |
| IMP-057 | Extract shared OpenBao auth helper (token + AppRole + lease-aware cache) for Console ingress and worker secret broker | BASELINE-ROADMAP-2026-02-10 | ⬜ |  |
| IMP-058 | Centralize approval context validation in shared approval-log domain module with typed error mapping at adapters | WORKBENCH-GOLDEN-PATH-M0-M1-2026-02-10 | ✅ | 2026-02-10 |
| IMP-059 | Add always-on Cursor rule to prefer root-cause fixes over workaround patches | WORKBENCH-GOLDEN-PATH-M0-M1-2026-02-10 | ✅ | 2026-02-10 |
| IMP-060 | Add fast Console server agent-focused test script (`test:server:agent-fast`) for prompt/routing iterations | WORKBENCH-M1-M3-2026-02-10 | ✅ | 2026-02-10 |
| IMP-061 | Add reusable eval harness async flush helper (`flushAgentStream`) for discovery-path stability | WORKBENCH-M1-M3-2026-02-10 | ✅ | 2026-02-10 |
| IMP-062 | Improve stale tool-catalog failure diagnostics in MCP snapshot tests with actionable regen command | WORKBENCH-M1-M3-2026-02-10 | ✅ | 2026-02-10 |
| IMP-063 | Add `test:server:recommendations-fast` script for recipe scoring/diagnostics/router recommendation endpoints | WORKBENCH-M4-M5-2026-02-11 | ⬜ |  |
| IMP-064 | Persist recommendation outcome/feedback weights across local server restarts (SQLite/Redis adapter) | WORKBENCH-M4-M5-2026-02-11 | ⬜ |  |
| IMP-065 | Add `test:server:blueprint-smoke` script for MCP-gated propose/run API validation | BLUEPRINT-DISCOVERY-2026-02-11 | ⬜ |  |
| IMP-066 | Add `test:server:discovery-fast` script for intent/discovery/evals contract loop | BLUEPRINT-DISCOVERY-2026-02-11 | ⬜ |  |
| IMP-067 | Add CI gate requiring MCP readiness smoke before blueprint-first release checks | BLUEPRINT-DISCOVERY-2026-02-11 | ⬜ |  |

---

## Near-Term (Next 2 Sprints)

| ID | Recommendation | Source | Status | Notes |
|----|----------------|--------|--------|-------|
| IMP-034 | Create `nx certify` target for automated certification | INCIDENT-LIFECYCLE-P6-2026-02-02 | ⬜ | Repeatable CI-integrated certification |
| IMP-035 | Observability asset generator from blueprint metadata | INCIDENT-LIFECYCLE-P6-2026-02-02 | ⬜ | Auto-dashboards for new workflows |
| IMP-036 | RBAC matrix generator from OCS metadata | INCIDENT-LIFECYCLE-P6-2026-02-02 | ⬜ | Auto-role documentation |
| IMP-037 | Architecture doc generator from workflow code | INCIDENT-LIFECYCLE-P6-2026-02-02 | ⬜ | Generate/update Mermaid docs from blueprints/descriptors |
| IMP-038 | Docs drift check (validate key control claims against code symbols) | INCIDENT-LIFECYCLE-P6-2026-02-02 | ⬜ | Prevent stale security-doc claims (e.g., renamed middleware) |
| IMP-039 | Add Workbench-scoped client test target (run only Workbench client tests) | WORKBENCH-UX-P4.4-2026-02-02 | ⬜ | Faster iteration; fewer unrelated suite failures |
| IMP-004 | Create planning accelerator workflow | OSCAL-2026-02-01 | ✅ | `.agent/workflows/plan-integration.md` |
| IMP-005 | Add upstream repo summarizer script | OSCAL-2026-02-01 | ✅ | `scripts/summarize-repo.sh` |
| IMP-006 | Build domain generator plugin | OSCAL-2026-02-01 | ✅ | 2026-02-02 (Plugin: `domain-generator.ts`) |
| IMP-012 | Add a debug helper/wrapper so Nx test failures show the underlying Vitest suite output | DX-ARTIFACTS-2026-02-02 | ✅ | Added `pnpm nx:test:debug <project>` + `test:*:debug` scripts and `tools/path/README.md` (2026-02-02) |
| IMP-013 | Add `@golden/path:sync` mode to regenerate `tool-catalog.json` (or emit actionable command) when missing | DX-ARTIFACTS-2026-02-02 | ✅ | Sync now emits a single actionable command + lists missing tool IDs (2026-02-02) |
| IMP-016 | Add Workbench tool-catalog refresh + show manifest `generated_at` | JIRA-WORKBENCH-2026-02-02 | ✅ | 2026-02-02 (Verified existing feature) |
| IMP-017 | Add deterministic constant/literal support in blueprint generator `input_mapping` | INCIDENT-LIFECYCLE-P4-2026-02-02 | ✅ | 2026-02-02 (`blueprint-generator.ts`) |
| IMP-018 | Create incident timeline capability for audit + post-mortem population (`golden.transformers.incident-timeline`) | INCIDENT-LIFECYCLE-P4-2026-02-02 | ✅ | 2026-02-02 (`incident-timeline.capability.ts`) |
| IMP-019 | Populate Slack approval role claims (`approverRoles`) from identity provider | INCIDENT-LIFECYCLE-P4-2026-02-02 | ⬜ | Allows safe role-gated approvals via Slack interactions |
| IMP-026 | Standardize repo-root policy file resolution helper (avoid cwd-dependent tests) | JIRA-WORKBENCH-2026-02-02 | ✅ | 2026-02-02 (`packages/core/src/utils/repo-root.ts` + refactors) |
| IMP-027 | Add worker activity registration checklist/helper for Temporal integration tests | JIRA-WORKBENCH-2026-02-02 | ✅ | 2026-02-02 (`packages/tools/mcp-server/src/mcp/test-worker-activities.ts`) |
| IMP-028 | CI guardrail: new capability must be discoverable (registry + manifest + Console `/api/mcp/tools`) | JIRA-WORKBENCH-2026-02-02 | ✅ | 2026-02-02 (Console tool catalog guardrail test) |
| IMP-031 | Persist workflow executions + approval decisions (replace in-memory execution store) | INCIDENT-LIFECYCLE-P5-2026-02-02 | ✅ | Postgres-backed `workflow_executions` + hybrid repo wiring (2026-02-02) |
| IMP-032 | Add canonical `incidentId` propagated across event ingestion + action execution context | INCIDENT-LIFECYCLE-P5-2026-02-02 | ✅ | Canonical incident linkage for events + executions + approvals (2026-02-02) |
| IMP-033 | Ensure required global skills are installed or vendored (UX/TDD) | INCIDENT-LIFECYCLE-P5-2026-02-02 | ✅ | Vendored skills + verify/install scripts + CI guardrail (2026-02-02) |

---

## Strategic (Roadmap)

| ID | Recommendation | Source | Status | Notes |
|----|----------------|--------|--------|-------|
| IMP-007 | Schema impact analysis tool | OSCAL-2026-02-01 | ⬜ | Design doc created |
| IMP-008 | Prior art index | OSCAL-2026-02-01 | ⬜ | Design doc created |
| IMP-009 | Auto-generate capability from specs | OSCAL-2026-02-01 | ⬜ | Design doc created |
| IMP-022 | Expand Domain Generator to full implementation | Compliance-2026-02-02 | ✅ | 2026-02-02 (Enhanced `domain-generator.ts`) |
| IMP-015 | Compliance E2E Suite | OSCAL-2026-02-01 | ⬜ | Test real agent execution compliance |
| IMP-040 | Server-backed shared draft IDs + template create endpoint | WORKBENCH-UX-P4.4-2026-02-02 | ⬜ | Enables multi-user collaboration and durable reuse; avoids URL payload limits |

---

## Impact Tracking

### Implemented Improvements — Measured Impact

| ID | Expected Impact | Actual Impact | Validated |
|----|-----------------|---------------|-----------|
| IMP-001 | Every ADR starts consistent | _(monitor next ADR)_ | ⬜ |
| IMP-002 | Agents understand OSCAL domain | _(monitor next OSCAL work)_ | ⬜ |
| IMP-003 | Faster CLI wrapper creation | _(monitor next capability)_ | ⬜ |
| IMP-010 | `nx test path` stays green after sync validations | `path:test` green again | ⬜ |
| IMP-011 | Generator invocations succeed without JSON parsing footguns | `context-extension` dry-run works with repeatable `--fields` | ⬜ |
| IMP-014 | Zero-config package creation with correct entry points | Verified via `test-scaffold-pkg` build | ⬜ |
| IMP-012 | Nx failures are diagnosable without losing suite output | `pnpm nx:test:debug <project>` provides verbose Vitest output | ⬜ |
| IMP-013 | Tool catalog drift is self-explanatory | Sync error lists missing IDs and exact regen command | ⬜ |
| IMP-006 | Domain Generator reduces boilerplate | `domain-generator.ts` produced valid code | ⬜ |
| IMP-020 | Build stability | `capabilities` build passed consistently | ⬜ |
| IMP-021 | Prevent interpolation bugs | Logic verified; rule added | ⬜ |
| IMP-023 | Dogfooding is runtime-true (cluster apply + rollout verified) | _(pending)_ | ⬜ |
| IMP-024 | CI triggers are robust (no quoting/escaping failures) | _(pending)_ | ⬜ |
| IMP-026 | No cwd-dependent policy failures in CI/tests | _(pending validation next runner change)_ | ⬜ |
| IMP-027 | No “activity not registered” failures in Temporal integration tests | _(pending validation next new workflow)_ | ⬜ |
| IMP-028 | New capabilities never ship undiscoverable in Workbench/MCP | _(pending validation next new capability)_ | ⬜ |
| IMP-022 | Richer generator output | Verified via unit tests | ⬜ |
| IMP-017 | Cleaner blueprints | Values inlined as constants | ⬜ |
| IMP-029 | Runbooks are readable in Console (not raw markdown) | Markdown rendered (GFM) + `javascript:` links neutralized | ⬜ |
| IMP-030 | Incident detail pages show precise approvals/executions without client filtering | Scoped endpoints + incident detail adoption; fixed route shadowing regression | ⬜ |
| IMP-043 | Workbench E2E “happy path” is deterministic and runnable | Playwright harness + Tier‑0 Workbench spec added | ⬜ |
| IMP-046 | Agent template suggestions require explicit confirmation | Dialog flow implemented + client test | ⬜ |
| IMP-048 | Prompt/tool regressions can be caught via fixtures | Eval harness + `test:evals` target added | ⬜ |
| IMP-049 | Spend visibility available for budgetKey-selected sessions | `/api/workbench/cost` + UI surfaces | ⬜ |
| IMP-055 | Default-import interop regressions in Console server are prevented | Namespace import guardrail + codemod/check scripts added | ⬜ |
| IMP-058 | Approval context contract is enforced consistently across entry points | Domain-level validation added + adapter mapping tests pass | ⬜ |
| IMP-059 | Root-cause-first implementation preference persists across sessions | Always-apply rule added in `.cursor/rules/` | ⬜ |
| IMP-060 | Faster prompt/routing feedback loops in Console server | `test:server:agent-fast` script added in `@golden/console` | ⬜ |
| IMP-061 | Less eval timing flake when asserting streamed outputs | Shared `flushAgentStream()` helper added to eval harness | ⬜ |
| IMP-062 | Faster diagnosis when deterministic catalog artifact is stale | MCP snapshot test now throws explicit `pnpm tools:regen-sync` guidance | ⬜ |
| IMP-065 | Fast MCP-gated smoke loop becomes a standard preflight command | _(pending)_ | ⬜ |
| IMP-066 | Discovery regressions are caught in a short deterministic loop | _(pending)_ | ⬜ |
| IMP-067 | Blueprint-first validation cannot bypass MCP readiness in CI | _(pending)_ | ⬜ |
| IMP-031 | Timeline/audit remains correct across long-running incidents | Postgres execution persistence enables durable history (validate in Postgres mode) | ⬜ |
| IMP-032 | Incident linking is deterministic across all subsystems | Canonical incidentId propagation rules implemented (validate with persisted data) | ⬜ |
| IMP-033 | UX/TDD guidance is consistently available in all dev environments | Vendored + bootstrap scripts verified; validate across fresh machine/CI | ⬜ |
| IMP-037 | Always-current incident lifecycle docs | _(pending)_ | ⬜ |
| IMP-038 | Fewer stale/incorrect security doc references | _(pending)_ | ⬜ |

---

## Declined / Archived

| ID | Recommendation | Reason | Date |
|----|----------------|--------|------|
| _(none yet)_ | | | |

---

## Adding Recommendations

When a retrospective produces recommendations:

1. Assign an ID (IMP-XXX)
2. Add to appropriate section (Immediate/Near-Term/Strategic)
3. Link back to source retrospective
4. Set initial status to ⬜ Proposed

When implementing:
1. Update status to 🟨 In Progress
2. When done, update to ✅ Implemented with date
3. Add to Impact Tracking section
4. Validate impact in subsequent retrospectives
