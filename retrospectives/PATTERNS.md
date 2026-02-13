# Recurring Patterns

Patterns observed across multiple retrospectives. When a pattern appears 3+ times, it should be addressed systematically (new skill, workflow, or tooling).

---

## Pattern Categories

### 🔴 Friction Patterns
Issues that repeatedly slow down work.

### 🟡 Knowledge Gaps
Domain knowledge that's frequently missing.

### 🟢 Success Patterns
Things that consistently work well and should be replicated.

### 🔵 Tooling Gaps
Missing tools or capabilities that would help.

---

## Active Patterns

### 🔴 Param-route Shadowing in Express Routers
**Occurrences:** 1 (IMP-030–033 Followthrough, 2026-02-02)  
**Description:** A `/:id`-style route registered before fixed-prefix routes can accidentally match those paths (e.g. `/:actionId` capturing `/executions`).  
**Impact:** False 404s and wasted time debugging “missing” endpoints; tests can fail in non-obvious ways.  
**Resolution:** Register fixed-prefix routes first; add a route test that hits fixed-prefix paths; add a brief router comment near `/:id` routes.

### 🔴 Nested anchors from `wouter` Link patterns
**Occurrences:** 1 (Workbench multi-surface work, 2026-02-02)  
**Description:** Using `Link` plus an inner `<a>` or “clickable row” composition can produce `<a>` inside `<a>` DOM nesting warnings.  
**Impact:** No immediate functional break, but noisy test output and risk of subtle interaction/a11y bugs later.  
**Resolution:** Standardize a row-link pattern (either `Link` renders the only anchor, or use a button/div + `setLocation`), and add a small shared component to avoid reintroducing it.

### 🔵 Contract-Complete, Runtime-Incomplete (Dogfooding gap)
**Occurrences:** 1 (Phase 7 Shipping & Traffic, 2026-02-02)  
**Description:** Work lands with strong schemas/tests/guardrails and deterministic discovery, but runtime execution (real infra, real secrets, real external services) remains unvalidated. Mirrors the Jira capability situation where container/runtime is placeholder (discovery is good; runtime usefulness lags).  
**Impact:** User expectation mismatch (“it’s implemented” vs “it runs in production”), and longer end-to-end cycles due to late integration friction.  
**Resolution:** Add explicit validation levels to plans (Contract vs Runtime Smoke vs Staging) and require a Kind-based runtime smoke harness for any “dogfooding” claim.

### 🔴 Shell vs TS Interpolation Confusion
**Occurrences:** 1 (Compliance Caps, 2026-02-02)
**Description:** Mixed Shell parameter expansion (`${VAR:-default}`) with TypeScript interpolation (`${var}`) in factory strings.
**Impact:** Build failures, parse errors.
**Resolution:** [IMP-021] Lint rule or strict escaping convention.

### 🔴 Shared Interface Mismatch (RetryPolicy)
**Occurrences:** 1 (Compliance Caps, 2026-02-02)
**Description:** Multiple files implemented `retryPolicy` missing `backoffCoefficient`, causing build failure across package.
**Impact:** Blocked build, required auditing multiple files.
**Resolution:** [IMP-020] Enforce strict type checks or provide factory helper for config objects.

### 🔴 Workspace package default-import interop (ESM/Vitest)
**Occurrences:** 2 (Engine MVP core capabilities, 2026-02-09; Baseline release/deploy roadmap, 2026-02-10)  
**Description:** Default imports of internal workspace packages (e.g. `import blueprints from '@golden/blueprints'`) can resolve to `undefined` in some TS/ESM/Vitest contexts, causing runtime 500s.  
**Impact:** Non-obvious runtime failures; time lost debugging “undefined export” issues.  
**Resolution:** Standardize `import * as blueprints from '@golden/blueprints'` (namespace imports) for internal workspace packages in the Console server; consider an eslint rule to disallow default imports from `@golden/*`.

### 🔴 Runtime smoke blocked by local Docker daemon
**Occurrences:** 1 (Engine MVP core capabilities, 2026-02-09)  
**Description:** Runtime smoke harnesses that depend on Docker (OpenBao/Temporal/Dagger) fail fast when Docker daemon isn’t running, without a clear preflight path.  
**Impact:** “Runtime smoke required” milestones become non-actionable on some environments; increases plan drift.  
**Resolution:** Add preflight checks + one actionable error message (“Start Docker Desktop / ensure daemon reachable”) to smoke scripts and docs.

### 🔴 Documentation drift (stale symbol/control references)
**Occurrences:** 1 (Incident Lifecycle Phase 6, 2026-02-02)  
**Description:** Documentation referenced a stale/incorrect symbol name for a security control (middleware) even though the correct implementation existed in code.  
**Impact:** Readers can assume a control is missing (or present) incorrectly; reduces trust in security posture documentation.  
**Resolution:** [IMP-038] Add a lightweight “docs drift” check (validate key doc claims against code symbols / grep allowlist) and document config-dependent controls explicitly (e.g., dev bypass vs production-required env).  

### 🔵 Workbench tool list can be stale until process restart
**Occurrences:** 2 (Jira Capability + Workbench Tooling, 2026-02-02; Jira Runtime + SecretRefs Follow-on, 2026-02-02)  
**Description:** New capabilities were added and tests passed, but the Workbench tool list did not include them until the Console server process serving `/api/mcp/tools` was restarted.  
**Impact:** Time lost verifying “missing” tools that were present in code/registry.  
**Resolution:** Add a visible `manifest.generated_at` indicator + a “refresh tools” action (or hot reload) in the Workbench tool catalog. Also document a canonical restart command for when code changes require process reload.

### 🔵 Nx test output is too terse
**Occurrences:** 1 (DX Artifacts, 2026-02-02)  
**Description:** `nx test path` failed without showing the underlying Vitest suite failure details; required running Vitest directly inside `tools/path` to find the real error.  
**Impact:** Extra troubleshooting steps and context switching.  
**Resolution:** Add a documented/debug wrapper or improve Nx test target output to surface underlying suite failures.

### 🔵 Hidden deterministic artifact coupling
**Occurrences:** 4 (DX Artifacts, 2026-02-02; Incident Lifecycle Phase 4, 2026-02-02; Baseline release/deploy roadmap, 2026-02-10; Workbench M1-M3 Assigned To-dos, 2026-02-10)  
**Description:** `@golden/path:sync` validates the presence of `packages/tools/mcp-server/src/manifest/tool-catalog.json`; generator tests did not seed it in fixtures, causing unrelated suite failures.  
**Impact:** Surprise failures in `path:test` after other work.  
**Resolution:** Always seed minimal deterministic tool-catalog fixtures in generator tests; consider adding a `sync` mode to regenerate the catalog.

### 🔴 Cross-surface secret auth drift (Console ingress vs worker secret broker)
**Occurrences:** 1 (Baseline release/deploy roadmap, 2026-02-10)  
**Description:** OpenBao auth/read logic lived in multiple runtime surfaces (Console webhook ingress and worker secret broker), so policy changes (e.g., AppRole support) required duplicate updates.  
**Impact:** Increased implementation and review overhead; higher risk of inconsistent secret access behavior under staging conditions.  
**Resolution:** Extract a shared OpenBao auth/token helper (token + AppRole + lease-aware cache) and consume it from both surfaces.

### 🔵 Capability/Blueprint registry drift blocks discoverability
**Occurrences:** 1 (Incident Lifecycle Phase 4, 2026-02-02)  
**Description:** Concrete capabilities/blueprints existed in code, but deterministic registries were missing entries, causing tool-catalog generation and sync to omit tool IDs.  
**Impact:** Sync/tool catalog loops and delayed MCP discoverability until registries were reconciled.  
**Resolution:** Add CI check enforcing “exports match registry”; run sync immediately after adding new artifacts; provide a single “regen + sync” command.

### 🔵 Generator CLI ergonomics for complex options
**Occurrences:** 1 (DX Artifacts, 2026-02-02)  
**Description:** Nx defaults/param parsing interacted poorly with “array of objects” schema options; required switching to a CLI-friendly `--fields=name:type[:optional|required]` repeated syntax.  
**Impact:** Initial generator invocation failures until schema and parsing were updated.  
**Resolution:** Prefer CLI-friendly option encodings for array inputs; document usage in schema descriptions.

### 🔵 Repo-root artifacts need cwd-independent resolution (Console runbooks)
**Occurrences:** 1 (Incident Lifecycle Phase 5, 2026-02-02)  
**Description:** The Console server runs from `packages/apps/console`, while operational artifacts (like `/runbooks/*.md`) live at repo root. Any server endpoint that reads repo-root artifacts must not depend on `process.cwd()`.  
**Impact:** Features appear “missing” in dev/test environments until path resolution is fixed.  
**Resolution:** Standardize a shared “workspace root finder” helper and require it for any repo-local artifact endpoints.

### 🔵 Observability assets need scrape wiring (Prometheus)
**Occurrences:** 1 (Workbench UX Phase 4.5, 2026-02-02)  
**Description:** Grafana dashboards and SLO docs can be added correctly, but remain non-actionable until Prometheus is configured to scrape the underlying metrics endpoint(s).  
**Impact:** Time lost debugging “empty” dashboards and uncertainty about whether SLOs are actually live.  
**Resolution:** Document canonical scrape endpoints for each service (and where scrape configs live). Add a quick smoke check that posts a synthetic event and verifies series appear in metrics output.

### 🔵 Approvals without incident/workflow context are not actionable
**Occurrences:** 2 (Incident Lifecycle Phase 5, 2026-02-02; Workbench Golden Path M0/M1 Foundations, 2026-02-10)  
**Description:** Approval items were technically present but lacked enough context (triggering eventId/serviceTags/contextType) to review safely.  
**Impact:** Increased operator uncertainty and context switching; harder to audit “why” for approvals.  
**Resolution:** Enforce a server-side minimum context contract (at least one of `workflowId|incidentId|draftTitle`) in the shared approval-log module, map validation errors consistently at adapters, and render the context in approval UIs.

### 🔴 Discovery prompts can drift from catalog-grounded truth
**Occurrences:** 1 (Blueprint Discovery Improvement Plan assigned todos, 2026-02-11)  
**Description:** Discovery-only asks (especially security capability inventory) can return generic suggestions when behavior depends on prompt-following rather than deterministic catalog grounding.  
**Impact:** Agents may suggest tools that are not actually available in the MCP catalog; reduces trust in blueprint-first flow.  
**Resolution:** Enforce discovery correctness at service boundary with deterministic catalog-grounded responses and explicit no-generation-on-discovery behavior; keep prompts as supportive constraints only.

### 🔴 Manual Upstream Research
**Occurrences:** 1 (OSCAL Compass, 2026-02-01)
**Description:** Manually navigating GitHub pages and READMEs chunk by chunk.
**Impact:** ~10 unnecessary tool calls, ~5 minutes per integration.
**Resolution:** Created `summarize-repo.sh` script. Monitor if this resolves the pattern.

### 🔴 Missing Domain Vocabulary
**Occurrences:** 1 (OSCAL Compass, 2026-02-01)
**Description:** Had to infer domain concepts (OSCAL) from scratch.
**Impact:** Time spent on basic questions instead of architecture.
**Resolution:** Created OSCAL compliance skill. Pattern: Create domain skills proactively.

### 🔴 ADR Template Missing
**Occurrences:** 1 (OSCAL Compass, 2026-02-01)
**Description:** ADR folder existed but no template.
**Impact:** Had to infer format from related skills.
**Resolution:** Created `docs/adr/TEMPLATE.md`. ✅ Resolved.

### 🔴 Inconsistent Package Entry Points
**Occurrences:** 1 (OSCAL Compass, 2026-02-01)
**Description:** Initial assumption about `src/index.ts` structure conflicted with repo standard (root `index.ts`), requiring refactor.
**Impact:** Lost time refactoring and debugging build failures.
**Resolution:** Standardize package generator to enforce root entry point.

### 🟢 Early Context Gathering
**Occurrences:** 1 (OSCAL Compass, 2026-02-01)
**Description:** Parallel reads of caps.md, project structure, and upstream docs.
**Impact:** Avoided basic clarifying questions, enabled strategic discussion.
**Replication:** Make this standard practice in `/plan-integration` workflow.

### 🟢 Discussion Before Deep Planning
**Occurrences:** 1 (OSCAL Compass, 2026-02-01)
**Description:** Asked strategic questions before creating detailed plan.
**Impact:** User answers shaped entire architecture, avoided rework.
**Replication:** Include strategic question phase in planning workflows.

---

## Graduated Patterns

_Patterns that have been fully addressed and can be archived._

### 🔴 E2E Harness Missing → Repeated E2E Deferrals (Workbench)
**Occurrences:** 4 (Workbench UX Phases 4.1–4.3, 2026-02-02; Workbench Tier‑0 Followthrough, 2026-02-09)  
**Description:** Multiple Workbench phases specified Playwright E2E coverage (library insertion, iterative refinement, run monitoring) but implementation repeatedly deferred because an E2E harness/CI target wasn’t available.  
**Impact:** Reduced end-to-end confidence; repeated manual validation; plan drift accumulates as “we’ll add E2E later.”  
**Resolution Implemented:** Added Playwright harness + Tier‑0 Workbench spec + deterministic `/api/chat` fixture mode (2026-02-09). Follow-up: wire Tier‑0 E2E into CI as a required gate.

---

## Adding New Patterns

When you notice something recurring:

1. Check if it already exists here
2. If yes, increment occurrence count and add session reference
3. If no, add new entry with:
   - Category (🔴🟡🟢🔵)
   - Occurrences count
   - Description
   - Impact
   - Proposed resolution

When occurrences ≥ 3, prioritize systematic resolution.
