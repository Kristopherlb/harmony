# Agent Startup Checklist

**Read this at the start of every session.**

This checklist helps agents leverage existing skills and learnings from past work.

---

## 1. Understand Context

Before diving into work:

- [ ] **Read the user request carefully** — What are they actually asking for?
- [ ] **Check `/retrospectives/PATTERNS.md`** — Are there known patterns for this type of work?
- [ ] **Check `/retrospectives/checkpoints/`** — Is there an existing checkpoint for this project?

### ⚠️ Critical Patterns to Watch For

**Do not repeat these mistakes:**

1.  **Shell vs TS Interpolation**: In factories involving shell scripts, do NOT confuse Shell expansion (`${VAR:-default}`) with TypeScript interpolation (`${var}`).
    -   *Fix:* Use proper escaping (`\${VAR}`) or `no-restricted-syntax` lint rules.
2.  **Shared Interfaces**: Be careful with `RetryPolicy` and other config objects. Ensure you implement the *complete* shape (e.g., missing `backoffCoefficient` breaks builds).
3.  **Generator Options**: When creating generators, use CLI-friendly options (repeatable `--fields`) instead of complex, brittle JSON parsing.
4.  **Workbench Stale State**: If you add tools but don't see them, the Workbench tool list might be stale. Restart the process before debugging "missing" tools.
5.  **MCP in Harmony**: When the workspace is this repo, Cursor runs the Harmony MCP server via `tools/scripts/run-harmony-mcp.mjs` (build then stdio). Tools are available automatically; running capabilities/blueprints requires Temporal + worker (`pnpm nx run harmony:dev-up` and `harmony:dev-worker`). See `docs/workbench/workbench-operator-command-cheatsheet.md` §0.

---

## 2. Select Relevant Skills

Based on the task type, load relevant skills:

| If the task involves... | Read this skill |
|-------------------------|-----------------|
| Creating capabilities | `capability-generator`, `external-cli-wrapper` |
| Integration planning | `/plan-integration` workflow |
| OSCAL/compliance | `oscal-compliance` |
| Blueprints/workflows | `workflow-composition-standard` |
| ADRs | Check `docs/adr/TEMPLATE.md` |
| Anything complex | Create a checkpoint first |

---

## 3. Check Prior Art

Before implementing:

- [ ] **Similar capabilities?** → Check `packages/capabilities/src/`
- [ ] **Similar patterns?** → Check relevant pattern catalog skill
- [ ] **Prior decisions?** → Check `docs/adr/`

---

## 4. During Long Sessions

If the session is >30 minutes or you've made significant progress:

- [ ] **Create a checkpoint** → Use `retrospective` skill
- [ ] **Note friction** → Track in checkpoint for later improvement
- [ ] **Note opportunities** → Skills or tools that would help

---

## 5. After Completing Work

- [ ] **Create a retrospective** → Use `retrospective` skill or `/retro report`
- [ ] **Update PATTERNS.md** → If you noticed recurring issues
- [ ] **Update IMPROVEMENTS.md** → Track recommendations
- [ ] **Create skills/workflows** → If you discovered missing tooling

---

## Key Files to Know

| File | Purpose |
|------|---------|
| `.cursor/skills/README.md` | Skill catalog with trigger table |
| `retrospectives/PATTERNS.md` | Known friction patterns |
| `retrospectives/IMPROVEMENTS.md` | Improvement tracker |
| `.agent/workflows/` | Available workflows |
| `docs/adr/` | Architecture decisions |

---

## Remember

> The goal is to get better over time. Every session should leave the codebase and tooling slightly better than before.
