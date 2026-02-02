## Progress
- [x] Todo completed: Phase 5.4 Timeline and Audit Views
- [x] Added incident-scoped timeline tab (events + executions join):
  - `packages/apps/console/client/src/pages/incidents.tsx`
- [x] Added global Timeline page:
  - `packages/apps/console/client/src/pages/timeline.tsx`
  - `packages/apps/console/client/src/App.tsx` (route `/timeline`)
  - `packages/apps/console/client/src/components/noc-header.tsx` (nav item)

## Learnings
- A UI-joined timeline (activity stream + executions) is enough to deliver immediate operator value, but it is not a durable audit log for long-running incidents.
- The join keys matter: `eventId` is best when present; `serviceTags` is a reasonable fallback but can produce false positives/negatives.

## Friction
| Issue | Impact | Potential Solution |
|-------|--------|-------------------|
| Timeline is composed client-side from multiple sources | Not reliable for long historical windows | Persist executions/approvals and add incident-scoped timeline query (IMP-031 + IMP-030) |
| No canonical `incidentId` across event ingestion and executions | Tag inference required | Add canonical incident id propagation (IMP-032) |

## Opportunities
- [ ] **Capability:** Durable incident timeline store + query endpoints (IMP-031 / IMP-030).
- [ ] **Docs:** Add operator docs explaining how timeline is composed and its limitations until persistence exists.

## Plan Alignment (Mandatory)
- Plan drift observed: none (Phase 5.4 delivered timeline/audit views).
- Proposed plan update(s):
  - Add Phase 5.4 note: define linking strategy (eventId vs incidentId) and persistence expectations before relying on timeline for compliance/audit.
- Any new required preflight steps:
  - Ensure executions carry `context.serviceTags` so global timeline filtering is meaningful.

## Improvements / Capabilities That Would Help Next
- [ ] **Capability:** Persist workflow execution + approval events (IMP-031).
- [ ] **Capability/Generator:** Incident-scoped approvals/executions endpoints (IMP-030).
- [ ] **Capability:** Canonical incident id propagation (IMP-032).

