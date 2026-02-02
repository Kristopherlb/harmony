# Retrospective: Jira Capability + Workbench Tool Registration

**Date:** 2026-02-02  
**Session Duration:** ~2–3 hours  
**Artifacts Produced:**
- Jira connector capabilities:
  - `packages/capabilities/src/connectors/jira-issue-search.capability.ts`
  - `packages/capabilities/src/connectors/jira-issue-count.capability.ts`
  - Tests:
    - `packages/capabilities/src/connectors/jira-issue-search.capability.test.ts`
    - `packages/capabilities/src/connectors/jira-issue-count.capability.test.ts`
- Capability registry + tool discovery updates:
  - `packages/capabilities/src/registry.ts` (registered Jira capabilities)
  - `packages/tools/mcp-server/src/manifest/capabilities.test.ts` (assert Jira tools exist)
- Console Jira integration migration (direct HTTP → platform execution):
  - `packages/apps/console/server/clients.ts`
  - `packages/apps/console/server/providers/clients.test.ts`
  - `packages/apps/console/server/routes.test.ts` (test env isolation)
- Config/secretRefs propagation through execute-capability stack:
  - `packages/core/src/wcs/execute-capability-activity.ts`
  - `packages/core/src/wcs/base-blueprint.ts`
  - `packages/core/src/wcs/base-blueprint.execute-by-id.test.ts`
  - `packages/blueprints/src/workflows/system/execute-capability.workflow.ts`
  - `packages/blueprints/src/workflows/execute-capability.workflow.test.ts`
  - `packages/blueprints/src/worker/execute-dagger-capability.ts`

---

## What Went Well

### 1. TDD kept the change safe across multiple packages
We used a Red → Green → Refactor loop to introduce the Jira capability surface (tests first), then wired discovery/manifest, then migrated Console to use the platform execution path.

### 2. Cross-package changes were validated end-to-end
After updating the execution envelope to carry `config` and `secretRefs`, we added tests that forced the propagation to be real (core → workflow schema → worker parsing) and re-ran suite tests across core/blueprints/capabilities/mcp-server/console.

### 3. Tool discovery is deterministic and now includes Jira
Once the running server was restarted, the Workbench tool endpoint returned:
- `golden.jira.issue.search`
- `golden.jira.issue.count`

---

## What Could Have Been Better

### 1. Workbench “tools list” lagged behind code changes (stale manifest)
Even with code + tests passing, Workbench didn’t show the Jira tools until the running Console server process was restarted (it was serving an older manifest snapshot).

**Impact:** Confusing “it’s implemented but not visible” state; time lost in verification loops.

### 2. Hidden runtime coupling: multiple long-lived dev processes
Multiple Console server runs existed over time, and port 5000 was bound by an older process. The UI kept asking `/api/mcp/tools` and getting an older `generated_at`.

**Impact:** Misleading signal (“tools don’t exist”) despite being present in source and tests.

### 3. Capability runtime is still placeholder (container prints stub output)
The Jira capabilities currently build a container shape and provide schemas/metadata/error mapping, but they don’t yet execute real HTTP against Jira inside the container runtime.

**Impact:** Great for discovery + contract stability, but not yet functionally useful for real Jira data without a follow-on runtime implementation.

---

## The Golden Path (If It Existed)

```
Step_1: Add capability + tests
  Output: Passing capability unit/contract tests

Step_2: Register capability + update manifest test
  Output: Manifest includes tool IDs deterministically

Step_3: Restart tool surface process automatically
  Output: Workbench tool list refreshes without manual restarts/guessing
```

**Estimated time with golden path:** ~60–90 minutes (vs ~2–3 hours actual)

---

## Recommendations

### Immediate (This Sprint)
| Action | Effort | Impact |
|--------|--------|--------|
| Add a Workbench-visible “manifest generated_at” + “refresh tools” button that forces a tool reload on the server | S | Prevents stale-tool confusion |
| Add a single documented “restart dev stack” command for tool-surface changes (console + worker) | S | Reduces manual process hunting |

### Near-Term (Next 2 Sprints)
| Action | Effort | Impact |
|--------|--------|--------|
| Implement real Jira HTTP execution inside the Jira capability container runtime (and parse JSON stdout into schemas) | M | Makes Jira capability actually usable |
| Replace passing raw secret values from Console with ISS-001 style secret refs + broker resolution (mount secrets, no env plaintext) | M | Security + policy alignment |

---

## Metrics
| Metric | Value | Notes |
|--------|-------|------|
| Test-first iterations | Multiple | Jira capability + propagation were driven by failing tests first |
| Cross-package suites run | 5 projects | core, blueprints, capabilities, mcp-server, console |
| Time lost to “not visible in Workbench” | ~15–30 min | Root cause: stale server process and cached manifest |

---

## Key Takeaway
> **Tool discovery correctness isn’t enough—developer feedback loops must include a reliable “refresh/reload” path so Workbench reflects new tools immediately.**

---

## Plan Alignment (Mandatory)

- **Plan drift observed:**
  - Needed to restart the long-lived Console process to see updated tools (not explicitly called out in the plan).
  - Discovered the platform execution path needed `config` + `secretRefs` propagation to support real integrations (expanded scope vs initial “capability only” work).

- **Proposed plan update(s) for next time (copy/paste):**
  - “After adding tools/capabilities, restart the tool-surface process (Console/MCP server) and confirm `/api/mcp/tools` lists the new IDs before debugging deeper.”
  - “If integrating a real external system, ensure execute-capability supports passing config + secretRefs end-to-end before migrating callers.”

---

## Improvements / Capabilities That Would Help Next
| Type | Proposal | Effort | Expected Impact |
|------|----------|--------|-----------------|
| Tooling | “Refresh tools” endpoint or UI button (no restart required) | S | Removes a recurring class of confusion |
| Skill/Docs | Add a short “debugging tool discovery” section to the Workbench/Console docs | S | Faster diagnosis |
| Capability | Jira HTTP runtime implementation + ISS-001 secret mounting | M | Turns discovery into production usefulness |

