## Progress
- [x] Todo completed: Phase 5.1 Incident Management Views
- [x] Added incidents list + detail routes:
  - `packages/apps/console/client/src/pages/incidents.tsx`
  - `packages/apps/console/client/src/App.tsx` (routes)
  - `packages/apps/console/client/src/components/noc-header.tsx` (nav item)
- [x] Added tests:
  - `packages/apps/console/client/src/pages/__tests__/incidents.test.tsx`

## Learnings
- Treating “incident” as a specialization of `Event` (`contextType: "incident"`) is a fast, workable Phase 5 approach that avoids introducing a new domain model too early.
- Even without dedicated workflow APIs, incident views become usable by leaning on existing `/api/activity/stream` and consistent tagging (`serviceTags`).

## Friction
| Issue | Impact | Potential Solution |
|-------|--------|-------------------|
| Incident detail initially lacked approvals/runbooks/timeline tabs | Reduced “single pane” value for operators | Add incident-scoped tabs that join existing sources (Phase 5.2–5.4) |

## Opportunities
- [ ] **Capability/Generator:** Add incident-scoped endpoints to remove client-side filtering (IMP-030).
- [ ] **Capability:** Propagate canonical `incidentId` across events + executions (IMP-032).

## Plan Alignment (Mandatory)
- Plan drift observed: none (Phase 5.1 delivered incident views as planned).
- Proposed plan update(s):
  - Add Phase 5.1 note: incident list/detail should ship with stable linking keys (eventId or incidentId) to support later approval/runbook/timeline joins.
- Any new required preflight steps:
  - Ensure `/api/activity/stream` is populated with `contextType=incident` in demo/seed data for meaningful UI.

## Improvements / Capabilities That Would Help Next
- [ ] **Capability:** Durable incident timeline store (supports Phase 5.4+ beyond UI-joined timelines).
- [ ] **Tooling:** Add “incident seed fixture” for Console tests/dev to make UI demos consistent.

