---
description: Accelerated planning workflow for integrating external ecosystems into Harmony
---

# Plan Integration Workflow

Use this workflow when planning the integration of an external ecosystem (OSCAL Compass, OpenSSF, cloud providers, etc.) into Harmony.

## Prerequisites

- Known upstream repository URL or project name
- Understanding of the integration goal (compliance, security, data, etc.)

---

## Step 1: Identify the External Ecosystem

**Goal:** Gather key links and identify the tools/APIs involved.

```
Questions to answer:
1. What is the upstream project? (GitHub org, main repos)
2. What are the key CLI tools or APIs?
3. What languages/runtimes are used? (Python, Go, Rust)
4. What data formats are consumed/produced? (JSON, YAML, OSCAL, SBOM)
```

**Output:** List of repos and tools to integrate.

---

## Step 2: Fetch and Summarize Upstream Repos

**Goal:** Extract key information from upstream documentation.

For each relevant repository:
1. Read the README to understand purpose and usage
2. Identify key commands or API endpoints
3. Note any authentication requirements
4. Identify output schemas or formats

**Tips:**
- Use `read_url_content` to fetch GitHub README files
- Look for OpenAPI specs, JSON schemas, or CLI help output
- Check for existing Docker images to wrap

---

## Step 3: Map to Harmony Primitives

**Goal:** Determine how upstream concepts map to Harmony.

Use this mapping guide:

| Upstream Concept | Harmony Primitive | Notes |
|------------------|-------------------|-------|
| CLI tool | Capability (COMMANDER pattern) | Wrap in Dagger container |
| REST API | Capability (CONNECTOR pattern) | Direct HTTP calls |
| Data transform | Capability (TRANSFORMER pattern) | Pure function logic |
| AI/LLM workflow | Capability (REASONER pattern) | LangGraph integration |
| Multi-step process | Blueprint | Compose capabilities |
| Background job | Temporal Workflow | Long-running or scheduled |

**Questions to resolve:**
1. Which OCS pattern fits? (See `.cursor/skills/open-capability-standard/`)
2. Which existing capabilities are similar? (Check `packages/capabilities/src/`)
3. Does this need a new domain? (Check `packages/domains/`)

---

## Step 4: Identify Prior Art

**Goal:** Find existing capabilities to reference.

Look for similar patterns in the codebase:

```bash
# Find capabilities by pattern
ls packages/capabilities/src/**/*.capability.ts

# Search for similar integrations
grep -r "from(" packages/capabilities/src/ | grep -i "<tool-name>"
```

**Reference skills:**
- External CLI Wrapper: `.cursor/skills/external-cli-wrapper/SKILL.md`
- Capability Generator: `.cursor/skills/capability-generator/SKILL.md`

---

## Step 5: Generate Implementation Plan

**Goal:** Create a structured implementation plan.

Use the implementation plan template structure:

```markdown
# Implementation Plan: [Integration Name]

## Context
[Problem statement and goals]

## Proposed Changes

### Phase 1: [First deliverable]
- [ ] File 1
- [ ] File 2

### Phase 2: [Second deliverable]
- [ ] File 3
- [ ] File 4

## Verification Plan
[How to test the integration]
```

Consider phasing:
1. **Foundation:** Schemas, domain models
2. **Core capability:** Main CLI/API wrapper
3. **Integration:** Connect to existing systems
4. **Dashboard/UI:** Surface to users
5. **Agent integration:** MCP tools, AI hints

---

## Step 6: Generate ADR

**Goal:** Document the architectural decision.

Use the ADR template at `docs/adr/TEMPLATE.md`:

1. Copy template to `docs/adr/ADR-XXX-<integration-name>.md`
2. Fill in decision summary, context, and drivers
3. Document alternatives considered
4. Define acceptance criteria

---

## Step 7: Strategic Questions for User

Before finalizing the plan, ask the user:

```
1. Opt-in or mandatory? Should this feature be enabled by default or per-tenant?
2. Enforcement levels? Should there be ADVISORY/WARNING/BLOCKING modes?
3. Priority order? What parts are most important to deliver first?
4. Existing data? Is there data to migrate or existing workflows to preserve?
5. External dependencies? Any blockers on upstream releases or APIs?
6. Timeline? What's the target delivery timeframe?
```

---

## Output Checklist

At the end of this workflow, you should have:

- [ ] List of upstream repos and tools identified
- [ ] Harmony primitive mapping complete
- [ ] Prior art capabilities identified
- [ ] Implementation plan draft (in brain artifacts)
- [ ] ADR draft (in `docs/adr/`)
- [ ] Outstanding questions for user documented

---

## Related Resources

- [Open Capability Standard](file:///Users/kristopherbowles/code/harmony/.cursor/skills/open-capability-standard/SKILL.md)
- [External CLI Wrapper](file:///Users/kristopherbowles/code/harmony/.cursor/skills/external-cli-wrapper/SKILL.md)
- [OSCAL Compliance](file:///Users/kristopherbowles/code/harmony/.cursor/skills/oscal-compliance/SKILL.md)
- [ADR Template](file:///Users/kristopherbowles/code/harmony/docs/adr/TEMPLATE.md)
