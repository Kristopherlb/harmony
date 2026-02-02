# Harmony Project - Agent Rules

## Session Startup

At the start of every session, agents should:

1. **Read the startup checklist**: `.cursor/skills/AGENT_STARTUP.md`
2. **Check for known patterns**: `/retrospectives/PATTERNS.md`
3. **Check for existing checkpoints**: `/retrospectives/checkpoints/`

## During Work

- For complex or long tasks (>30 min), create checkpoints using the `retrospective` skill
- When creating capabilities, read `external-cli-wrapper` or `capability-generator` skills first
- When planning integrations, use the `/plan-integration` workflow

## After Work

- For significant completed work, create a retrospective
- Track friction patterns in `/retrospectives/PATTERNS.md`
- Track improvement recommendations in `/retrospectives/IMPROVEMENTS.md`

## Key Locations

| Location | Purpose |
|----------|---------|
| `.cursor/skills/README.md` | Skill catalog with triggers |
| `.cursor/skills/AGENT_STARTUP.md` | Session startup checklist |
| `/retrospectives/` | Retrospective storage |
| `/.agent/workflows/` | Available workflows |
| `/docs/adr/` | Architecture decisions |

## Available Workflows

- `/plan-integration` — Integration planning
- `/retro` — Retrospective checkpoint/analysis/report
