---
name: retrospective
description: Continuous improvement through checkpoints, analysis, and retrospectives. Use during and after projects to capture learnings, reduce repeated friction, and keep plans aligned to reality.
argument-hint: "[topic or project name] + [time window] + [artifacts changed]"
---

# Retrospective Skill

Use this skill to create **durable, reusable learnings** from real work. It standardizes:
- **Checkpointing** (mid-project) so sessions can be resumed safely
- **Analysis** so improvements are discovered systematically, not by vibe
- **Retrospectives** so outcomes are actionable, measurable, and tracked
- **Pattern + improvement tracking** so repeated friction gets eliminated
- **Plan alignment** so future runs are cheaper and more deterministic

## When to Use

- **During a project:** create a checkpoint when a session is >30 minutes, when context is changing, or before pausing work.
- **After a milestone:** capture what changed in scope/assumptions, and what was unexpectedly hard.
- **End of project:** produce a full retrospective and ensure the learnings are captured as patterns/improvements.
- **When giving recommendations:** first verify the repo’s **current state** (architecture, prior art, and existing patterns) to avoid low-signal or redundant suggestions.

---

## Plan Alignment (Mandatory)

Whenever you create a checkpoint or full retrospective, **do this first**:

1. **Preflight: confirm current state (avoid stale advice)**
   - Read `docs/architecture/ARCHITECTURE.md` for the Runtime Tetrad and package boundaries.
   - Skim `retrospectives/PATTERNS.md` and `retrospectives/IMPROVEMENTS.md` for known friction and existing fixes.
   - Check for prior art: similar modules in `packages/*` and existing skills in `.cursor/skills/`.

2. **Check plan drift**
   - Compare the plan (if one exists) to what was actually built.
   - Look for drift in: scope, sequencing, renamed artifacts, new dependencies, new scripts/tools, removed steps, changed assumptions.

3. **Make plan updates actionable**
   - If you are allowed to edit the plan: update it to reflect reality and to reduce future friction.
   - If you are NOT allowed to edit the plan: write “Proposed plan updates” into the retrospective as copy/paste-ready text blocks.

4. **Prefer systematic fixes**
   - Prefer recommendations that reduce repeated manual work: generators, scripts, deterministic artifacts, contract tests, and skills.
   - Avoid one-off “do better” advice. Every recommendation must be implementable (owner, effort, and concrete next step).

This is not optional: a retro that doesn’t tighten the plan will allow the same friction to recur.

---

## Checkpoint (Mid-Project)

Use checkpoints to save state during long-running work. This prevents knowledge loss between sessions.

### When to Checkpoint

- After completing a significant phase
- When you notice something that should be documented
- Before ending a session with unfinished work
- When you discover friction or missing tooling

### How to Checkpoint

1. Create a file in `retrospectives/checkpoints/` named:

```
YYYY-MM-DD-<project-name>-checkpoint.md
```

2. Use the [checkpoint template](file:///Users/kristopherbowles/code/harmony/.cursor/skills/retrospective/references/checkpoint-template.md)

3. Include:
   - Current progress (what's done, what remains)
   - Key learnings so far
   - Friction points encountered
   - Improvement opportunities noticed
   - Questions or blockers
   - Plan alignment (what drifted + recommended plan adjustments)
   - Improvements/capabilities that would have helped

### Output expectations (checkpoint)
- **File created**: `retrospectives/checkpoints/YYYY-MM-DD-<project>-checkpoint.md`
- **If plan editing is not allowed**: include “Proposed plan updates” as copy/paste blocks.
- **If you found repeated friction**: add/update an entry in `retrospectives/PATTERNS.md`.

### Example

```markdown
# Checkpoint: OSCAL Compass Integration

**Date:** 2026-02-01
**Session:** Planning phase

## Progress
- [x] Initial research complete
- [x] Strategic questions answered
- [ ] Implementation plan (in progress)
- [ ] ADR (not started)

## Learnings
- OSCAL has 5 document types, not 3 as initially assumed
- Trestle is the recommended authoring tool

## Friction
- Had to manually read 6 GitHub pages to understand the ecosystem
- No existing OSCAL vocabulary in the codebase

## Opportunities
- Create an OSCAL skill to avoid this research next time
- Add a repo summarizer script

## Plan Alignment
- Plan drift: <what changed and why>
- Proposed plan update: <copy/paste-ready adjustment>

## Improvements / Capabilities That Would Help Next
- <script/tool/generator/capability that would reduce repeated manual work>
```

---

## Analysis (Improvement Discovery)

Use analysis to systematically identify improvement opportunities in the codebase.

### Preferred approach (use project utilities first)
Prefer repo utilities and existing scripts over one-off ad-hoc commands:

- Run the repository “health check” script:

```bash
bash .cursor/skills/retrospective/scripts/analyze-codebase.sh packages
```

- If Nx output is too terse (known repo pattern), prefer the debug helpers:

```bash
pnpm nx:test:debug <project>
pnpm test:capabilities:debug
pnpm test:path:debug
```

### Analysis Checklist

Run through this checklist and document findings:

#### Code Quality
- [ ] **DRY violations** — Duplicated code that should be abstracted
- [ ] **Pattern inconsistencies** — Similar things done differently
- [ ] **Dead code** — Unused exports, unreachable paths
- [ ] **Complex functions** — Functions >50 lines or cyclomatic complexity >10

#### Testing
- [ ] **Coverage gaps** — Critical paths without tests
- [ ] **Test patterns** — Inconsistent test structures
- [ ] **Missing edge cases** — Error paths not tested

#### Documentation
- [ ] **Stale docs** — Documentation that doesn't match code
- [ ] **Missing docs** — Public APIs without documentation
- [ ] **Skill gaps** — Knowledge that should be a skill but isn't

#### DevEx
- [ ] **Missing workflows** — Repetitive processes that could be automated
- [ ] **Slow feedback** — Tests or builds that are slow
- [ ] **Confusing errors** — Error messages that don't help

#### Architecture
- [ ] **Coupling** — Components that are too tightly coupled
- [ ] **Circular dependencies** — Packages that depend on each other
- [ ] **Abstraction leaks** — Implementation details exposed

### Analysis Commands (optional; use sparingly)

```bash
# Check tests broadly
pnpm nx run-many --target=test

# Check tests with coverage (if configured)
pnpm nx run-many --target=test --coverage
```

---

## Retrospective (Post-Project)

Use the full retrospective format after completing significant work.

### Template Structure

Use the [retrospective template](file:///Users/kristopherbowles/code/harmony/.cursor/skills/retrospective/references/retrospective-template.md):

1. **What Went Well** — Practices to continue
2. **What Could Be Better** — Issues encountered
3. **Recommendations** — Actionable improvements
   - Immediate (this sprint)
   - Near-term (next 2 sprints)
   - Strategic (roadmap)
4. **Metrics** — Quantitative data (tool calls, time, artifacts)
5. **Key Takeaway** — Single-sentence summary
6. **Plan Alignment** — What to change in the plan so the next run is easier
7. **Improvements / Capabilities** — Tools/skills/generators/capabilities to reduce future friction

### After Creating a Retrospective

1. Save the retrospective to `retrospectives/sessions/`
2. Update `retrospectives/PATTERNS.md` (if you observed recurring patterns)
3. Add recommendations to `retrospectives/IMPROVEMENTS.md` with IDs (IMP-XXX) and status
4. If plan editing is allowed, update the plan; otherwise include copy/paste-ready plan edits
5. Prefer a small number of high-impact recommendations over a long list of vague ones

---

## Pattern Management

Patterns emerge when issues recur across multiple projects.

### Adding Patterns

When you notice something in a retrospective that might recur:

1. Check if it exists in `/retrospectives/PATTERNS.md`
2. If yes: increment occurrence count, add session reference
3. If no: add new pattern with:
   - Category (🔴 Friction, 🟡 Knowledge Gap, 🟢 Success, 🔵 Tooling Gap)
   - Occurrences count
   - Description
   - Impact
   - Proposed resolution

### Graduating Patterns

When occurrences ≥ 3:
1. Create a formal solution (skill, workflow, tool)
2. Implement the solution
3. Move pattern to "Graduated" section
4. Monitor for recurrence

---

## Improvement Tracking

Track recommendations from backlog to implementation to impact.

### Workflow

```
Proposed → In Progress → Implemented → Impact Validated
    ↓                          ↓
 Declined                   Archived (if obsolete)
```

### Validation

After implementing an improvement:
1. Add to "Impact Tracking" in `/retrospectives/IMPROVEMENTS.md`
2. State expected impact
3. In subsequent retrospectives, validate actual impact
4. Mark as validated when confirmed effective

---

## Maintenance Tasks

### Weekly
- Review open checkpoints (>7 days old) — complete or update
- Check for stale improvements (proposed >30 days)

### Monthly
- Review patterns for graduation candidates
- Archive resolved improvements
- Clean up obsolete recommendations

### Quarterly
- Aggregate metrics across retrospectives
- Identify meta-patterns (patterns in the patterns)
- Update this skill based on learnings

---

## References

- [Checkpoint Template](file:///Users/kristopherbowles/code/harmony/.cursor/skills/retrospective/references/checkpoint-template.md)
- [Retrospective Template](file:///Users/kristopherbowles/code/harmony/.cursor/skills/retrospective/references/retrospective-template.md)
- [Analysis Checklist](file:///Users/kristopherbowles/code/harmony/.cursor/skills/retrospective/references/analysis-checklist.md)
- [Retrospectives Directory](file:///Users/kristopherbowles/code/harmony/retrospectives/)
- Repo architecture: `docs/architecture/ARCHITECTURE.md`
- ADRs: `docs/adr/`
