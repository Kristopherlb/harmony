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

### 🔵 Workbench tool list can be stale until process restart
**Occurrences:** 1 (Jira Capability + Workbench Tooling, 2026-02-02)  
**Description:** New capabilities were added and tests passed, but the Workbench tool list did not include them until the Console server process serving `/api/mcp/tools` was restarted.  
**Impact:** Time lost verifying “missing” tools that were present in code/registry.  
**Resolution:** Add a visible `manifest.generated_at` indicator + a “refresh tools” action (or hot reload) in the Workbench tool catalog.

### 🔵 Nx test output is too terse
**Occurrences:** 1 (DX Artifacts, 2026-02-02)  
**Description:** `nx test path` failed without showing the underlying Vitest suite failure details; required running Vitest directly inside `tools/path` to find the real error.  
**Impact:** Extra troubleshooting steps and context switching.  
**Resolution:** Add a documented/debug wrapper or improve Nx test target output to surface underlying suite failures.

### 🔵 Hidden deterministic artifact coupling
**Occurrences:** 2 (DX Artifacts, 2026-02-02; Incident Lifecycle Phase 4, 2026-02-02)  
**Description:** `@golden/path:sync` validates the presence of `packages/tools/mcp-server/src/manifest/tool-catalog.json`; generator tests did not seed it in fixtures, causing unrelated suite failures.  
**Impact:** Surprise failures in `path:test` after other work.  
**Resolution:** Always seed minimal deterministic tool-catalog fixtures in generator tests; consider adding a `sync` mode to regenerate the catalog.

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

_(none yet)_

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
