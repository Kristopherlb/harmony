# Workbench Baseline Metrics

**Purpose:** Establish baseline measurements for ROI calculation before implementing workbench improvements (Pre-work 3.0). Used to validate Phase 5 success metrics (e.g. time-to-workflow -50%, adoption 80%).

**Owner:** Product + Platform  
**Last updated:** 2026-02-02

---

## 1. Workflow Creation Time

| Method | Description | Baseline (target to measure) | Notes |
|--------|-------------|------------------------------|--------|
| Manual | Create workflow from scratch (canvas + config) without AI | _TBD hours_ | Time from blank canvas to runnable workflow |
| Existing workbench | Create workflow via chat + canvas (current implementation) | _TBD hours_ | Same definition of “done” |
| With templates (post Phase 4.1) | Start from library template then customize | _N/A_ | To be measured after Library UX |

**Definition of “workflow created”:** User has a draft on canvas with ≥1 node, accepts/approves it, and can trigger run (or equivalent “done” criterion agreed with product).

**How to measure:** Time-tracking in staging/dev; user self-report or session replay for MVP.

---

## 2. Tool Usage Patterns

| Metric | Baseline (target to measure) | Source |
|--------|------------------------------|--------|
| Tools exposed in workbench | 63 capabilities + 9 blueprints (from plan) | `tool-catalog.json` / MCP manifest |
| Most-used tool IDs | _TBD_ | Telemetry (post Phase 4.5) or manual log review |
| Chat→tool invocation rate | _TBD % of sessions_ | Backend logs / future analytics |
| RESTRICTED tool approval rate | _TBD_ | Approval queue + audit log (post Phase 4.1.5) |

**Current state:** No workbench-specific telemetry yet; baseline can be “no data” with a plan to instrument in Phase 4.5.

---

## 3. Error / Failure Rates

| Metric | Baseline (target to measure) | Notes |
|--------|------------------------------|--------|
| Draft accept rate | _TBD %_ | Accepted proposals / total proposals |
| Draft reject rate | _TBD %_ | Rejected or abandoned |
| Workflow execution success rate | _TBD %_ | Successful runs / total runs (when execution is triggered from workbench) |
| Chat errors (e.g. tool not found, parse error) | _TBD count or %_ | Server logs / client errors |

**Current state:** Establish “pre-improvement” snapshot once minimal instrumentation exists (e.g. one week of dev/staging usage).

---

## 4. Developer / Operator Feedback (Qualitative)

**Pain points to capture (interviews or surveys):**

- Time to create a workflow manually vs. with workbench
- Friction: missing tools, stale tool list, unclear approval context
- Discoverability: can users find the right template or capability?
- Trust: do users understand what the assistant will do before approving?

**Format:** Free-text or structured survey; summarize in this doc or link to Confluence/Notion.

| Topic | Notes |
|-------|--------|
| Pain points | _To be filled from interviews_ |
| Friction | _To be filled_ |
| Discoverability | _To be filled_ |
| Trust / clarity | _To be filled_ |

---

## 5. How This Feeds Phase 5 Success Metrics

| Persona | Phase 5 Metric | Baseline needed |
|---------|----------------|-----------------|
| End User | Time to create workflow -50% vs. manual | §1 workflow creation time (manual vs. workbench) |
| Leadership | 80% of workflows created via workbench | §1 + source-of-creation telemetry |
| Domain Expert | 50% of workflows use template | §2 tool/template usage (post-library) |
| Agent | 30% of chats suggest template | Chat analytics (post Phase 4.2) |

---

## 6. Next Steps

1. **Product/Platform:** Run 1–2 week baseline collection (staging or dev) once basic usage is possible.
2. **Instrumentation:** Add minimal events (e.g. draft_created, draft_accepted, workflow_run_started) so Phase 4.5 taxonomy can populate these tables.
3. **Revisit:** Update this doc when Phase 4.5 (observability) and Phase 5 validation are in scope.
