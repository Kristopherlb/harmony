## Jira Capability Runtime + Workbench Tool Refresh (SPP-001 Plan)

**Date:** 2026-02-02  
**Owner:** Platform  
**Scope:** Make Jira capabilities *functionally executable* (not stubs) and eliminate “tools not showing up” friction in Workbench/Console by adding a reliable refresh + visibility path.

---

## Phase 0: External Knowledge Assessment

### External Knowledge Needed

| Topic | Question | Research Source | Findings |
|-------|----------|-----------------|----------|
| Atlassian Jira REST auth | What’s the canonical Basic vs OAuth2 bearer header behavior for Jira Cloud? | Existing `spec/jira.openapi.json`, Atlassian docs | TBD (confirm bearer token format and required scopes) |
| Dagger HTTP patterns | What is the existing Harmony pattern for performing HTTP in capability containers (node runtime vs curl)? | Existing connectors (`packages/capabilities/src/connectors/*`) | TBD (select standard runtime approach) |
| ISS-001 secret resolution | What is the canonical secret ref → mount → runtime consumption path today? | `packages/core/src/binders/secret-broker.ts`, ISS-001 skill/docs | TBD (ensure no plaintext secret values cross app boundaries) |

### Confidence After Research

| Area | Before | After | Notes |
|------|--------|-------|-------|
| Jira runtime implementation | Medium | TBD | We already have OpenAPI spec; need auth + error semantics confirmation |
| Workbench refresh design | Medium | TBD | Need to confirm where tool manifest is cached and served |
| Security posture | Medium | TBD | Must enforce secret refs + mounting end-to-end |

---

## Phase 1: Multi-Persona Evaluation

### Persona: Agent (AI Assistant)

**Alignment Score:** 7/10  

| Aspect | Current Plan | Gap | Mitigation |
|--------|--------------|-----|------------|
| Tool Discovery | Capabilities exist and are in manifest | Workbench can show stale tool list | Add refresh endpoint + `generated_at` display |
| Context Propagation | `config` + `secretRefs` now propagate | Console still passes plaintext values | Enforce secret refs in Console integration |
| Determinism | Platform path uses Temporal workflow | Tool refresh must not violate determinism | Keep refresh in HTTP/UI surface, not workflows |

### Persona: Developer (Platform Contributor)

**Alignment Score:** 6/10  

| Aspect | Current Plan | Gap | Mitigation |
|--------|--------------|-----|------------|
| Fast Feedback | Tests exist across packages | “Restart the right process” is tribal knowledge | Add `pnpm dev:restart-tools` (or equivalent) + docs |
| Minimal Boilerplate | Capabilities follow existing patterns | Jira runtime still stub | Implement a standard HTTP runtime helper pattern |

### Persona: End User (Platform Operator)

**Alignment Score:** 6/10  

| Aspect | Current Plan | Gap | Mitigation |
|--------|--------------|-----|------------|
| Usability | Workbench lists tools | No visible freshness indicator | Show `generated_at`, last refresh result, and errors |
| Clear Workflows | Console uses platform path | Jira capability not functionally returning real data | Implement runtime + user-facing errors |

### Persona: Leadership (Platform Engineering)

**Alignment Score:** 7/10  

| Aspect | Current Plan | Gap | Mitigation |
|--------|--------------|-----|------------|
| ROI | Reduced time debugging tools | No baseline metric | Record “tool refresh latency” and “restart count” |
| Security | Secret refs intended | Plaintext still flowing from Console | Enforce ISS-001 compliance gates in tests |

### Persona: Domain Expert (Console Operator / On-Call)

**Alignment Score:** 6/10  

| Aspect | Current Plan | Gap | Mitigation |
|--------|--------------|-----|------------|
| Trust | Tool list correctness | Staleness breaks trust quickly | Provide explicit “Refresh tools” and status |
| Diagnostics | Some logs exist | No quick “why tools missing” path | Add UI status + server logs keyed by traceId |

**Readiness:** Needs Pre-Work (avg < 7.0 due to missing refresh + Jira runtime)

---

## Phase 2: Gap Analysis

### Prioritized Gaps

| Priority | Gap | Impact | Action |
|----------|-----|--------|--------|
| P0 | Workbench tool list can be stale (no freshness UI / refresh action) | Misleads users into thinking tools are missing | Add refresh endpoint + `generated_at` display |
| P0 | Jira capabilities return stub output | Capability exists but isn’t usable | Implement HTTP runtime + output parsing |
| P1 | Console still passes secret *values* (not refs) | ISS-001 violation risk | Convert to secret refs + broker resolution |
| P2 | Missing “single command” to restart the tool surface | Slower dev loop | Add script + docs/runbook |

### Skills Integration Matrix (relevant to this plan)

| Skill | Workbench Refresh | Jira Runtime | Secrets Migration | Testing |
|-------|------------------|--------------|------------------|---------|
| test-driven-development | ✓ | ✓ | ✓ | ✓ |
| typescript-expert | ✓ | ✓ | ✓ | ✓ |
| ui-ux-pro-max | ✓ |  |  |  |
| infrastructure-secrets (ISS-001) |  |  | ✓ | ✓ |
| testing-certification-standard (TCS-001) |  | ✓ | ✓ | ✓ |
| golden-observability (GOS-001) | ✓ | ✓ | ✓ |  |

---

## Phase 3: Pre-Work Identification

### Pre-Work 3.1: Confirm tool-manifest ownership + cache layer

**Purpose:** Avoid “refresh” implementation in the wrong place.  
**Blocks:** Workbench refresh endpoint and UI status.  
**Effort:** S  
**Owner:** Platform  

**Deliverable:**
- File path: `docs/integrations/mcp-tools-refresh.md`
- Contents: where manifest is generated, where cached, refresh flow and failure modes

### Pre-Work 3.2: Decide Jira runtime implementation strategy

**Purpose:** Standardize container HTTP execution (curl vs node fetch, error handling, JSON output).  
**Blocks:** Jira runtime implementation and tests.  
**Effort:** S  
**Owner:** Platform  

**Deliverable:**
- File path: `docs/integrations/jira-runtime-implementation.md`
- Contents: auth headers, rate limit handling, pagination, error mapping to OCS categories

### Pre-Work 3.3: Define ISS-001 secret ref contract for Console → platform path

**Purpose:** Eliminate plaintext secrets; define how Console supplies references.  
**Blocks:** Console migration to secret refs.  
**Effort:** S  
**Owner:** Platform + Console  

**Deliverable:**
- File path: `docs/security/console-to-capability-secrets.md`
- Contents: secret ref shapes, broker resolution expectations, local-dev guidance

### Dependency Matrix

| Pre-Work Item | Depends On | Enables | Parallelizable With |
|---------------|------------|---------|---------------------|
| 3.1 Tool manifest ownership | None | Refresh endpoint + UI | 3.2, 3.3 |
| 3.2 Jira runtime strategy | None | Jira runtime build | 3.1, 3.3 |
| 3.3 Secret ref contract | None | Secrets migration | 3.1, 3.2 |

---

## Execution Plan (Implementation)

### Phase 4A: Workbench/Console tool refresh + freshness indicator

**Goal:** Make it obvious when tools are stale and allow a reliable refresh without restarting processes.

- **Deliverables**
  - Server: add a refresh action that re-reads/regenerates the tool list and returns status
  - UI: show `generated_at` and last refresh result; add “Refresh tools” button
- **TDD tests (RED first)**
  - Server test: refresh endpoint returns newer `generated_at` (or unchanged + reason)
  - UI test: renders `generated_at`; button triggers refresh and updates list
- **Acceptance checks**
  - Adding a new capability + running dev server shows tool within one refresh
  - Refresh failures show an actionable error (not silent)

### Phase 4B: One-command restart path for local dev (documented)

**Goal:** Even with refresh, provide a canonical restart command for the full tool surface and worker stack.

- **Deliverables**
  - `package.json` script(s) or existing Nx target(s) that restart the right processes
  - Short runbook entry in docs
- **Acceptance checks**
  - New developer can follow docs and reliably see new tools

### Phase 4C: Jira capability runtime v1 (HTTP + output parsing)

**Goal:** Replace stub container output with real Jira REST calls and validated output.

- **Deliverables**
  - Implement an HTTP runtime in the container for:
    - `golden.jira.issue.search` → `/rest/api/3/search/jql`
    - `golden.jira.issue.count` → `/rest/api/3/search/approximate-count`
  - Print JSON to stdout that matches declared output schema(s)
- **TDD tests (RED first)**
  - Contract tests for request construction (headers, query/body)
  - Error mapping tests (401/403/429/5xx)
  - Output shape tests (min required keys)
- **Acceptance checks**
  - Can run capability locally with mocked Jira endpoint and see non-stub output

### Phase 4D: ISS-001 secrets: remove plaintext secret passing from Console

**Goal:** Console supplies **secret references** only; worker resolves and mounts secrets.

- **Deliverables**
  - Update Console integration to pass secret refs (not values)
  - Ensure secret broker path resolution is used end-to-end
  - Add tests to prevent regressions (no plaintext values in memo/logs/payload)
- **Acceptance checks**
  - No Jira email/token values appear in logs
  - Capabilities can still authenticate via mounted secrets

---

## Phase 5: Success Metrics Definition

| Persona | Metric | Target | How to Measure |
|---------|--------|--------|----------------|
| Developer | Time to see new tool in Workbench after adding capability | < 2 minutes | Manual benchmark + docs checklist |
| End User | “Tool missing” incidents caused by staleness | 0 | Track refresh errors and support reports |
| Leadership | Secrets passed as refs (not values) in Console path | 100% | Unit tests + log scanning in CI |
| Agent | Tool discoverability | 100% | MCP manifest audit tests |

---

## Out of Scope (for this plan)

- Expanding Jira capability surface beyond search/count (create/update issues)
- Adding Jira-specific UI features in Console beyond enabling execution

