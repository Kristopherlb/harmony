# Project Skills (Cursor Agent Skills)

Skills in this directory follow the [Cursor Agent Skills](https://cursor.com/docs/context/skills) layout: each skill is a folder with a `SKILL.md` file (required) and optional `scripts/`, `references/`, and `assets/`.

---

## ⚡ Quick Reference: When to Use Which Skill

**AGENTS: Read this section first when starting any task.**

| Trigger | Skill to Use | Path |
|---------|--------------|------|
| Building a new capability | `capability-generator` | [SKILL.md](capability-generator/SKILL.md) |
| Wrapping an external CLI | `external-cli-wrapper` | [SKILL.md](external-cli-wrapper/SKILL.md) |
| Working with OSCAL/compliance | `oscal-compliance` | [SKILL.md](oscal-compliance/SKILL.md) |
| Planning an integration | Use workflow: `/plan-integration` | [workflow](../.agent/workflows/plan-integration.md) |
| Mid-project, want to save progress | `retrospective` (checkpoint) | [SKILL.md](retrospective/SKILL.md) |
| End of project, reflecting | `retrospective` (full retro) | [SKILL.md](retrospective/SKILL.md) |
| Writing an ADR | Use template | [TEMPLATE.md](../docs/adr/TEMPLATE.md) |
| Understanding OCS patterns | `open-capability-standard` | [SKILL.md](open-capability-standard/SKILL.md) |
| Blueprint composition | `workflow-composition-standard` | [SKILL.md](workflow-composition-standard/SKILL.md) |

---

## 🔄 Auto-Trigger Guidance

**AGENTS: These patterns should trigger automatic skill usage.**

### Always Check at Start of Session
1. Read `/retrospectives/PATTERNS.md` — Are there known friction patterns for this type of work?
2. Check `/retrospectives/checkpoints/` — Is there an existing checkpoint for this project?

### During Work
- **Creating a capability?** → Read `capability-generator/SKILL.md` first
- **Wrapping a CLI?** → Read `external-cli-wrapper/SKILL.md`, check prior art
- **Planning integration?** → Follow `/plan-integration` workflow
- **Session >30 min or significant progress?** → Create checkpoint via `retrospective` skill

### After Work
- **Completed significant work?** → Create retrospective
- **Noticed friction or missing tooling?** → Update `/retrospectives/PATTERNS.md`
- **Created improvement recommendations?** → Add to `/retrospectives/IMPROVEMENTS.md`

---

## 📚 Skill Catalog

### Meta Skills (Process & Improvement)

| Skill | Purpose |
|-------|---------|
| `retrospective` | Checkpoints, analysis, retrospectives, pattern tracking |
| `agent-decision-records` | Capture and audit agent decisions |

### Integration Skills

| Skill | Purpose |
|-------|---------|
| `external-cli-wrapper` | Pattern for wrapping CLI tools in Dagger |
| `oscal-compliance` | OSCAL vocabulary and Harmony mapping |

### Capability & Blueprint Skills

| Skill | Purpose |
|-------|---------|
| `open-capability-standard` | OCS patterns (Connector, Commander, etc.) |
| `capability-generator` | Generate capabilities from specs |
| `capability-quality-assurance` | Testing and quality patterns |
| `workflow-composition-standard` | Blueprint composition patterns |
| `blueprint-descriptor-standard` | Blueprint structure |
| `pattern-catalog-capabilities` | Capability pattern examples |
| `pattern-catalog-blueprints` | Blueprint pattern examples |

### Architecture & Standards

| Skill | Purpose |
|-------|---------|
| `agent-specification-standard` | Agent behavior standards |
| `agent-interaction-protocol` | Agent communication patterns |
| `activity-envelope-standard` | Activity wrapper patterns |
| `classification-semantics-standard` | Data classification |
| `determinism-guardrails` | Non-determinism handling |
| `naming-and-identity-standard` | Naming conventions |
| `versioning-and-compatibility-standard` | Versioning patterns |
| `unified-identity-model` | Identity management |

### Infrastructure & Operations

| Skill | Purpose |
|-------|---------|
| `infrastructure-secrets` | Secret management patterns |
| `golden-observability` | Observability patterns |
| `certification-and-audit` | Compliance certification |
| `testing-certification-standard` | Testing requirements |

### Code Generation

| Skill | Purpose |
|-------|---------|
| `generate-blueprint-code` | Blueprint code generation |
| `generate-golden-dashboard` | Dashboard generation |
| `generator-scaffolding-standard` | Generator patterns |

---

## 🗂️ Related Locations

| Location | Purpose |
|----------|---------|
| `/retrospectives/` | Persistent retrospective storage |
| `/retrospectives/PATTERNS.md` | Cross-project patterns |
| `/retrospectives/IMPROVEMENTS.md` | Improvement tracker |
| `/.agent/workflows/` | Agent workflows (slash commands) |
| `/docs/adr/` | Architecture Decision Records |
| `/docs/design/` | Design documents |

---

## Skill Structure

Each skill folder contains:
- `SKILL.md` (required) — YAML frontmatter + instructions
- `references/` — Detailed reference documentation
- `scripts/` — Executable scripts for automation
- `assets/` — Additional resources

```
.cursor/skills/<skill-name>/
├── SKILL.md              ← Read this first
├── references/
│   └── detailed-docs.md
└── scripts/
    └── helper.sh
```
