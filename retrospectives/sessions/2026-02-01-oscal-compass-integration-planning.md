# Retrospective: OSCAL Compass Integration Planning

**Date:** 2026-02-01  
**Session Duration:** ~35 minutes  
**Artifacts Produced:**
- `task.md` — Task breakdown
- `implementation_plan.md` — 5-phase implementation plan
- `docs/adr/ADR-001-oscal-compass-integration.md` — Formal ADR

---

## What Went Well

### 1. Early Context Gathering Paid Off
Starting with parallel reads of `caps.md`, project structure, and the OSCAL Compass GitHub gave me enough context to have a meaningful strategic discussion rather than asking clarifying questions about basics.

### 2. User Dialogue Before Deep Planning
The initial decision to **discuss before plan** (asking 6 strategic questions) avoided wasted effort. The user's answers shaped the entire architecture:
- Opt-in → led to `TenantComplianceConfig` design
- Configurable enforcement → led to the ADVISORY/WARNING/BLOCKING triad
- Dashboard priority → influenced phase ordering

### 3. Incremental Artifact Delivery
Delivering the implementation plan first, getting feedback, then producing the ADR allowed the user to inject critical refinements (staleness, merge conflicts, caching) before the ADR was written.

### 4. Existing Standards Were Discoverable
The `.cursor/skills/` structure made it easy to find existing patterns (ADR format, certification skill, OCS) and ensure the new work was consistent.

---

## What Could Have Been Better

### 1. Too Much Manual Research
I manually navigated:
- GitHub pages chunk by chunk (6+ API calls to read OSCAL Compass content)
- Directory structures recursively
- Multiple files to understand the existing capability pattern

**Impact:** ~10 unnecessary tool calls, ~5 minutes of elapsed time.

### 2. No Existing OSCAL Context
I had to infer how OSCAL schemas work from scratch. There was no:
- Pre-existing OSCAL taxonomy/glossary in the project
- Skill that explained "what is OSCAL and how should Harmony use it"
- Reference to prior discussions about compliance frameworks

### 3. Capability Pattern Required Manual Inference
I had to read `open-capability-standard.mdx` and infer the pattern. A machine-readable "capability template" or schema would have let me:
- Auto-validate my proposed `CapabilityCompliance` block
- Generate boilerplate for the new capabilities

### 4. No "Prior Art" Index for Integration Patterns
When wrapping Python tools (Trestle, C2P) in Dagger, I had to assume patterns. A catalog of "how we've previously wrapped external CLIs" would have accelerated this.

### 5. ADR Template Was Missing
The `docs/adr/` folder was empty. I had to infer the ADR format from the agent-decision-records skill, which is related but not the same thing.

---

## The Golden Path (If It Existed)

Here's what an ideal "compliance integration" workflow would have looked like:

```
┌─────────────────────────────────────────────────────────────────────┐
│  Step 1: Run nx generate @harmony/compliance:init                   │
│                                                                     │
│  Outputs:                                                           │
│  - packages/domains/compliance/ (scaffolded with models, services)  │
│  - packages/schema-registry/src/oscal.ts (OSCAL schemas)            │
│  - docs/adr/ADR-xxx-compliance-integration.md (template)            │
│  - .cursor/skills/compliance-integration/SKILL.md (guidance)        │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 2: Agent reads generated SKILL.md, which contains:           │
│  - OSCAL glossary & concepts                                        │
│  - Links to upstream OSCAL Compass repos                            │
│  - Decision matrix for Trestle vs C2P vs custom                     │
│  - "How to add a new compliance capability" checklist               │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 3: nx generate @harmony/capability:new trestle                │
│                                                                     │
│  Outputs:                                                           │
│  - packages/capabilities/src/compliance/trestle.capability.ts       │
│  - packages/capabilities/src/compliance/trestle.capability.test.ts  │
│  - Pre-filled metadata, schemas, and Dagger factory stub            │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 4: Agent fills in the factory logic, referencing:            │
│  - examples/external-cli-wrapper.capability.ts (prior art)         │
│  - Upstream Trestle CLI docs (auto-fetched via skill script)        │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 5: nx compliance:validate                                     │
│                                                                     │
│  - Validates all capability compliance blocks                       │
│  - Generates coverage report                                        │
│  - Flags missing control mappings                                   │
└─────────────────────────────────────────────────────────────────────┘
```

**Total time with golden path:** ~10 minutes (vs ~35 minutes actual)

---

## What Would Have Made This Simple

### 1. A "Domain Integration" Generator
```bash
nx generate @harmony/domain:new compliance --upstream-repo=oscal-compass/compliance-trestle
```
This would:
- Scaffold the domain structure
- Fetch upstream README and extract key concepts
- Generate a SKILL.md with integration guidance
- Create an ADR template pre-filled with the decision drivers

### 2. A Skills Catalog with "Upstream Integration" Pattern
A skill that teaches agents how to wrap external Python/Go CLIs:
```markdown
## External CLI Wrapper Pattern

When wrapping an external CLI in a Dagger container:

1. Pin the version in `docker-compose.yml`
2. Use this factory template: [link]
3. Test pattern: mock the container, verify arguments
4. Prior art: terraform.capability.ts, kubectl.capability.ts
```

### 3. OSCAL Vocabulary Skill
A skill that pre-loads OSCAL knowledge:
```markdown
## OSCAL Glossary

- **Catalog:** A collection of controls (e.g., NIST 800-53)
- **Profile:** A selection/tailoring of controls from a catalog
- **SSP:** System Security Plan documenting how controls are implemented
- **Assessment Results:** Findings from evaluating the SSP

## Harmony-OSCAL Mapping

| Harmony Concept | OSCAL Equivalent |
|-----------------|------------------|
| Capability | Component Definition |
| Blueprint | System |
| Tenant | Authorization Boundary |
```

### 4. A "Planning Accelerator" Workflow
A `.agent/workflows/plan-integration.md` that guides agents through:
1. Identify the external ecosystem (OSCAL Compass, OpenSSF, etc.)
2. Fetch and summarize upstream repos
3. Map to existing Harmony primitives
4. Generate implementation plan template
5. Generate ADR template

### 5. Schema Validation for Proposed Changes
Before I proposed the `CapabilityCompliance` schema extension, I should have been able to run:
```bash
nx schema:validate --proposed-changes=./proposed-capability-compliance.ts
```
This would verify my proposed schema is compatible with existing OCS.

### 6. "What Would Break" Impact Analysis
A command that shows downstream impact:
```bash
nx impact:analyze --change="security.compliance added to Capability"

Output:
- 45 existing capabilities need migration (no compliance block)
- 3 blueprints reference capabilities (will inherit compliance context)
- Dashboard will surface compliance posture (new feature)
- MCP tool registry needs schema update
```

---

## Recommendations for Future Work

### Immediate (This Sprint)

| Action | Effort | Impact |
|--------|--------|--------|
| Create `docs/adr/TEMPLATE.md` | 30min | Every ADR starts consistent |
| Add OSCAL vocabulary to a skill | 1hr | Agents understand domain language |
| Document "External CLI Wrapper" pattern | 1hr | Future Trestle/C2P work is faster |

### Near-Term (Next 2 Sprints)

| Action | Effort | Impact |
|--------|--------|--------|
| Build `nx generate @harmony/domain:new` | 1 week | Any new domain is scaffolded instantly |
| Create "planning accelerator" workflow | 2 days | Agents follow consistent planning process |
| Add upstream repo summarizer script | 3 days | Agents can quickly understand external projects |

### Strategic (Roadmap)

| Action | Effort | Impact |
|--------|--------|--------|
| Schema impact analysis tool | 2 weeks | Prevents breaking changes, speeds review |
| Prior art index (capability patterns) | 1 week | Agents reference existing patterns |
| Auto-generate capability from OpenAPI/CLI | 3 weeks | Wrappers become trivial |

---

## Metrics for This Session

| Metric | Value | Target | Notes |
|--------|-------|--------|-------|
| Tool calls | 22 | <15 | Too much manual exploration |
| Clarifying questions | 6 | 3-5 | Good—strategic questions |
| Artifacts produced | 3 | 2-3 | Appropriate |
| User round-trips | 3 | 2-3 | Good—iterative refinement |
| Time to first plan | ~10min | <5min | Need better context pre-loading |
| Total session time | ~35min | <20min | Golden path would halve this |

---

## Key Takeaway

> **The absence of domain-specific skills and generators forced manual research and inference. The codebase has excellent standards but lacks the meta-tooling to help agents (and humans) apply those standards efficiently to new domains.**

The OSCAL Compass integration is a poster child for "recurring integration pattern"—we'll do this again for other ecosystems. Investing in the golden path now will pay dividends on every future integration.
