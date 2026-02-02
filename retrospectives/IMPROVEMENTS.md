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

---

## Near-Term (Next 2 Sprints)

| ID | Recommendation | Source | Status | Notes |
|----|----------------|--------|--------|-------|
| IMP-034 | Create `nx certify` target for automated certification | INCIDENT-LIFECYCLE-P6-2026-02-02 | ⬜ | Repeatable CI-integrated certification |
| IMP-035 | Observability asset generator from blueprint metadata | INCIDENT-LIFECYCLE-P6-2026-02-02 | ⬜ | Auto-dashboards for new workflows |
| IMP-036 | RBAC matrix generator from OCS metadata | INCIDENT-LIFECYCLE-P6-2026-02-02 | ⬜ | Auto-role documentation |
| IMP-037 | Architecture doc generator from workflow code | INCIDENT-LIFECYCLE-P6-2026-02-02 | ⬜ | Generate/update Mermaid docs from blueprints/descriptors |
| IMP-038 | Docs drift check (validate key control claims against code symbols) | INCIDENT-LIFECYCLE-P6-2026-02-02 | ⬜ | Prevent stale security-doc claims (e.g., renamed middleware) |
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
