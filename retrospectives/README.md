# Retrospectives

This directory is the persistent memory for all agent retrospectives and continuous improvement activities.

## Purpose

1. **Learn from history** — Agents can review past sessions to avoid repeating mistakes
2. **Track patterns** — Recurring issues become visible and addressable
3. **Measure improvement** — See if recommendations actually get implemented
4. **Share knowledge** — Multi-agent systems can learn from each other's experiences

## Structure

```
/retrospectives/
├── README.md              ← You are here
├── PATTERNS.md            ← Cross-project recurring patterns
├── IMPROVEMENTS.md        ← Master improvement tracker
├── sessions/              ← Completed retrospectives
│   └── YYYY-MM-DD-<topic>.md
└── checkpoints/           ← Mid-project progress saves
    └── YYYY-MM-DD-<project>-checkpoint.md
```

## Usage

### During a Project

Use `/retro checkpoint` or reference the [retrospective skill](file:///Users/kristopherbowles/code/harmony/.cursor/skills/retrospective/SKILL.md) to save progress:

```markdown
## Checkpoint: [Project Name]
**Date:** YYYY-MM-DD
**Progress:** What's done, what's remaining
**Learnings:** What I've discovered
**Friction:** What's slowing me down
**Opportunities:** Improvements I've noticed
```

### After a Project

Create a full retrospective in `sessions/`:
- What went well
- What could be better
- Concrete recommendations (immediate/near-term/strategic)
- Metrics

### Maintenance

Periodically review:
- [ ] Archive stale checkpoints (>30 days with no follow-up)
- [ ] Consolidate recurring patterns into `PATTERNS.md`
- [ ] Update `IMPROVEMENTS.md` with implementation status
- [ ] Clean up recommendations that are no longer relevant

## Related

- [Retrospective Skill](file:///Users/kristopherbowles/code/harmony/.cursor/skills/retrospective/SKILL.md) — How to conduct retrospectives
- [Plan Integration Workflow](file:///Users/kristopherbowles/code/harmony/.agent/workflows/plan-integration.md) — Related planning workflow
