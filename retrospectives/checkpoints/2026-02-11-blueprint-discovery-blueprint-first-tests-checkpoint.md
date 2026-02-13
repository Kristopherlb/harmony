# Checkpoint: Blueprint-First Tests

**Date:** 2026-02-11  
**Session:** Todo `blueprint-first-tests`  
**Time Spent:** ~25 minutes

## Progress

### Completed
- [x] Added `server/blueprint-first-api-smoke.test.ts`.
- [x] Validated propose -> run -> status/result flow without canvas dependency.
- [x] Enforced MCP readiness check before propose/run assertions.

### In Progress
- [ ] Expand staging-smoke coverage outside local test harness.

### Remaining
- [ ] Final docs and session retrospective.

## Key Learnings

1. API-first smoke tests provide stable golden-path confidence without UI coupling.
2. MCP gate precheck belongs inside the smoke flow, not as an optional side test.

## Friction Points

| Issue | Impact | Potential Solution |
|-------|--------|-------------------|
| Propose endpoint uses a separate service shape from chat path | Potential confusion in coverage claims | Keep smoke test explicit about endpoint scope |

## Improvement Opportunities

- [ ] **Workflow:** Add a named npm script for blueprint-first smoke gate.

## Plan Alignment (Mandatory)

- Plan drift observed: none
- Proposed plan update(s): include dedicated API smoke test file in required validation list.
- Any new required preflight steps: MCP readiness gate helper.

## Improvements / Capabilities That Would Help Next

- [ ] **Tooling**: Add `test:server:blueprint-smoke` command.

## Questions / Blockers

1. None
2. None

## Reflection-to-Action (Mandatory)

1. Is there anything you know now that if you knew when you started you would do differently?  
   Yes, start by codifying gate helper then compose smoke flow around it.
2. Any decisions you would change?  
   No.
3. Any of that actionable that you would do now given the opportunity?  
   Yes, keep API smoke independent from UI/canvas state.
