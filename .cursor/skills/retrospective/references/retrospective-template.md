# Retrospective Template

Use this template for full retrospectives after completing significant work.

---

# Retrospective: [Project/Task Name]

**Date:** YYYY-MM-DD  
**Session Duration:** ~XX minutes  
**Artifacts Produced:**
- [Artifact 1]
- [Artifact 2]

---

## What Went Well

### 1. [Success Category]
[Description of what worked and why it was effective.]

### 2. [Success Category]
[Description of what worked and why it was effective.]

### 3. [Success Category]
[Description of what worked and why it was effective.]

---

## What Could Have Been Better

### 1. [Issue Category]
[Description of the problem.]

**Impact:** [Quantify if possible: time lost, tool calls wasted, etc.]

### 2. [Issue Category]
[Description of the problem.]

**Impact:** [Quantify if possible.]

### 3. [Issue Category]
[Description of the problem.]

**Impact:** [Quantify if possible.]

---

## The Golden Path (If It Existed)

_Describe what an ideal workflow would look like for this type of work._

```
┌─────────────────────────────────────────────────────────────────────┐
│  Step 1: [Ideal first step]                                         │
│  Outputs: [What would be produced]                                  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 2: [Ideal second step]                                        │
│  Outputs: [What would be produced]                                  │
└─────────────────────────────────────────────────────────────────────┘
```

**Estimated time with golden path:** ~XX minutes (vs ~XX minutes actual)

---

## Recommendations

### Immediate (This Sprint)

| Action | Effort | Impact |
|--------|--------|--------|
| [Action 1] | [Time estimate] | [Expected benefit] |
| [Action 2] | [Time estimate] | [Expected benefit] |

### Near-Term (Next 2 Sprints)

| Action | Effort | Impact |
|--------|--------|--------|
| [Action 1] | [Time estimate] | [Expected benefit] |
| [Action 2] | [Time estimate] | [Expected benefit] |

### Strategic (Roadmap)

| Action | Effort | Impact |
|--------|--------|--------|
| [Action 1] | [Time estimate] | [Expected benefit] |
| [Action 2] | [Time estimate] | [Expected benefit] |

---

## Metrics

| Metric | Value | Target | Notes |
|--------|-------|--------|-------|
| Tool calls | XX | <XX | [Context] |
| Clarifying questions | XX | XX | [Context] |
| Artifacts produced | XX | XX | [Context] |
| User round-trips | XX | XX | [Context] |
| Time to first plan | ~XX min | <XX min | [Context] |
| Total session time | ~XX min | <XX min | [Context] |

---

## Key Takeaway

> **[Single sentence summarizing the most important learning from this work.]**

---

## Plan Alignment (Mandatory)

_What should change in the plan so the next run is easier and less error-prone?_

- Plan drift observed: [scope/order/assumptions that changed]
- Plan update(s) to apply next time: [copy/paste-ready text]
- New preflight steps to add: [scripts/tests/artifacts]

---

## Reflection-to-Action (Mandatory)

_Answer these directly, then capture what was implemented now._

1. Is there anything you know now that if you knew when you started you would do differently?
2. Any decisions you would change?
3. Any of that actionable that you would do now given the opportunity?

### Do Now action implemented + test command used (mini snippet)

```md
**Do Now Action Implemented:** [refactor/process/function change completed in this session]
**Why now:** [short reason this reduces repeated friction]
**Files touched:** [`path/a`, `path/b`]
**Validation command used:** `pnpm <target-or-script>`
**Validation result:** [pass/fail + short note]
```

---

## Improvements / Capabilities That Would Help Next

_What tools/skills/generators/capabilities would have reduced friction or prevented mistakes?_

| Type | Proposal | Effort | Expected Impact |
|------|----------|--------|-----------------|
| Tooling | [e.g., debug wrapper, lint check, generator option] | [estimate] | [impact] |
| Skill/Docs | [e.g., update a skill, add a reference doc] | [estimate] | [impact] |
| Capability/Generator | [e.g., new capability, extend generator] | [estimate] | [impact] |

---

## Follow-Up Actions

After completing this retrospective:

- [ ] Update `/retrospectives/PATTERNS.md` with any recurring patterns
- [ ] Add recommendations to `/retrospectives/IMPROVEMENTS.md` with IDs
- [ ] Move this file to `/retrospectives/sessions/`
- [ ] Create skills/workflows for immediate recommendations (if applicable)
