## SPP-001 Usage Reflection

**Project:** Incident Lifecycle — Phase 5 (Console UI)  
**Date:** 2026-02-02

### What Worked Well
- Persona framing was directionally correct: End User (SRE) concerns about context switching and auditability drove the right UI structure (incident detail tabs + global timeline).
- The protocol’s “missing artifact” thinking maps cleanly to Console work: UI needs docs (UX review), API contracts (schemas), and tests (TDD).

### What Was Missing
| Gap | What Happened | Skill Update |
|-----|---------------|--------------|
| Repo-root artifact access check | Runbooks live at repo root, server runs from `packages/apps/console`; endpoints must not depend on cwd | Add a pre-work checklist item: “Repo-local artifacts must use workspace-root resolution.” |
| Approval actionability prompt | Approval queue existed but lacked enough context to approve safely | Add End User + Agent prompts: “Does approval item show eventId/contextType/serviceTags/reasoning?” |
| Link safety for operator-facing markdown | Runbooks are markdown; rendering needs safe link handling | Add a docs/tooling gap item: “Markdown renderer must disallow `javascript:` / raw HTML by default.” |

### Scoring Calibration
- Scores would likely remain “Ready” for Phase 5, but the above gaps suggest a “Needs Pre-Work” rating if runbooks/timeline are treated as compliance-grade from day one.

### New Patterns Discovered
- Repo-root artifacts need cwd-independent resolution (Console runbooks).
- Approvals without incident/workflow context are not actionable.

### Prompts to Add
| Persona | New Prompt | Why Needed |
|---------|------------|------------|
| End User (SRE) | “Can I approve/reject without leaving the page? If not, what context is missing?” | Avoids non-actionable approval queues |
| Agent | “When I surface an approval, what fields do I include to explain why it’s safe?” | Drives contract completeness for approvals |
| Developer | “Does any endpoint read repo-local artifacts? If yes, is path resolution cwd-independent and tested?” | Prevents environment-dependent failures |

