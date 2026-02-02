---
name: strategic-planning-protocol
description: Multi-persona plan evaluation, gap analysis, and pre-work identification for complex initiatives. Use before executing any multi-phase project to maximize success probability.
argument-hint: project-name or plan-file-path
---

# Strategic Planning Protocol (SPP-001)

Use this skill to transform a draft plan into a comprehensive, persona-validated roadmap with identified gaps, required artifacts, and success-enabling pre-work.

## When to Use

- Before executing any multi-phase project (3+ phases)
- After creating an initial plan but before implementation
- When inheriting or reviewing an existing roadmap
- When a project spans multiple packages, teams, or domains
- When you need to ensure alignment across different stakeholders

## Core Principle

**Plans fail not from bad ideas but from missing foundations.** This skill ensures you identify and address gaps before they become blockers.

---

## Phase 0: External Knowledge Assessment

Before evaluating the plan, assess what external knowledge is needed.

### External Research Triggers

Ask these questions. If any answer is "yes", research before proceeding:

| Question | If Yes... |
|----------|-----------|
| Does this plan use patterns/frameworks not in the codebase? | Research latest documentation and examples |
| Does this integrate with external services I haven't used? | Get API docs, authentication flows, rate limits |
| Is this the first implementation of a new capability type? | Find reference implementations |
| Are there security/compliance requirements I'm uncertain about? | Research standards and best practices |
| Has the underlying technology changed since I last used it? | Check for breaking changes, deprecations |

### External Research Template

```markdown
### External Knowledge Needed

| Topic | Question | Research Source | Findings |
|-------|----------|-----------------|----------|
| [Framework/Pattern] | How to implement X? | Official docs, examples | [Key patterns] |
| [Integration] | How does Y API work? | OpenAPI spec, tutorials | [Auth, endpoints] |
| [Best Practice] | What's the current standard? | Web search, community | [Recommendations] |

### Confidence After Research

| Area | Before | After | Notes |
|------|--------|-------|-------|
| Implementation approach | Low/Medium/High | Low/Medium/High | |
| Integration feasibility | Low/Medium/High | Low/Medium/High | |
| Security posture | Low/Medium/High | Low/Medium/High | |
```

### When to Skip Phase 0

- All patterns are already in the codebase
- All integrations have existing capabilities
- High confidence in implementation approach

---

## Phase 1: Multi-Persona Evaluation

Evaluate the plan from 5 perspectives. For each persona, score alignment (1-10) and identify gaps.

### Scoring Rubric

Use this rubric for consistent scoring across personas:

| Score | Meaning | Criteria |
|-------|---------|----------|
| 9-10 | **Excellent** | All needs addressed, patterns documented, no gaps identified |
| 7-8 | **Good** | Most needs addressed, minor gaps can be resolved during execution |
| 5-6 | **Adequate** | Core needs addressed, but significant gaps require pre-work |
| 3-4 | **Weak** | Major concerns, substantial pre-work or plan revision needed |
| 1-2 | **Poor** | Fundamental misalignment, plan needs significant rethinking |

### Readiness Thresholds

| Average Score | Readiness | Action |
|---------------|-----------|--------|
| ≥7.0 | **Ready** | Proceed with execution |
| 5.0-6.9 | **Needs Pre-Work** | Complete identified pre-work, then proceed |
| <5.0 | **Needs Rethink** | Revise plan before investing in pre-work |

### Required Personas

#### 1. Agent (AI Assistant)
**Key Concerns:** Tool discoverability, determinism, context propagation, HITL clarity

| Evaluation Criteria | Questions to Ask |
|---------------------|------------------|
| Tool Discovery | Are all new capabilities registered in MCP? Will agents find them? |
| Determinism | Does workflow code follow WCS-001 determinism rules? |
| Context Propagation | Is GoldenContext properly extended and propagated? |
| HITL Clarity | Are approval points clearly defined with signals? |

**Generative Prompts for Agent Evaluation:**
```
Imagine you are an AI agent trying to execute this plan's outcomes.
Walk through each phase and ask:

1. "When a user asks me to [action from this plan], what tool do I invoke?"
   - If unclear → Gap: MCP registration or tool naming
   
2. "What information do I need to pass to each capability?"
   - If unclear → Gap: Schema documentation or aiHints
   
3. "If something fails mid-workflow, can I retry safely?"
   - If no → Gap: Idempotency or determinism violation
   
4. "When do I need human approval before proceeding?"
   - If unclear → Gap: HITL signal definitions
   
5. "How do I know if the operation succeeded?"
   - If unclear → Gap: Output schema or status indicators
```

#### 2. Developer (Platform Contributor)
**Key Concerns:** Dogfooding, clear patterns, fast feedback, minimal boilerplate

| Evaluation Criteria | Questions to Ask |
|---------------------|------------------|
| Dogfooding | Have we used the platform to build the platform? |
| Clear Patterns | Do skills exist for the patterns we're using? |
| Fast Feedback | Are tests comprehensive and fast? |
| Minimal Boilerplate | Do generators exist for repetitive scaffolding? |

**Generative Prompts for Developer Evaluation:**
```
Imagine you are a new developer implementing a similar feature next month.
Walk through the plan and ask:

1. "What patterns will I use that aren't documented?"
   - If any → Gap: Skill creation needed
   
2. "What files will I create more than twice?"
   - If any → Gap: Generator needed
   
3. "How will I know if my code follows the standards?"
   - If unclear → Gap: Linting rules or TDD guidance
   
4. "Where will I get stuck waiting for information?"
   - Each wait → Gap: Documentation or spec needed
   
5. "What would I copy-paste from this implementation?"
   - Each item → Gap: Should be a pattern, not copy-paste
```

#### 3. End User (Platform Operator)
**Key Concerns:** Usability, response speed, clear workflows, minimal training

| Evaluation Criteria | Questions to Ask |
|---------------------|------------------|
| Usability | Is the UI intuitive? Are user flows documented? |
| Response Speed | Are SLOs defined? Is performance measured? |
| Clear Workflows | Are procedures documented? Do runbooks exist? |
| Minimal Training | Is there an onboarding guide? |

**Generative Prompts for End User Evaluation:**
```
Imagine you are an SRE at 3am trying to use this system.
Walk through the plan and ask:

1. "What will I click/type to accomplish the main task?"
   - If unclear → Gap: UX design or user flow needed
   
2. "How long will I wait for results?"
   - If unknown → Gap: SLO definition needed
   
3. "What do I do if it doesn't work?"
   - If unclear → Gap: Error handling or troubleshooting guide
   
4. "How will I learn to use this without reading code?"
   - If can't → Gap: User documentation needed
   
5. "What will confuse me about the terminology?"
   - Each term → Gap: Glossary or tooltips needed
```

#### 4. Leadership (Platform Engineering)
**Key Concerns:** ROI, compliance, security, strategic alignment, observability

| Evaluation Criteria | Questions to Ask |
|---------------------|------------------|
| ROI | What metrics demonstrate value? Is baseline captured? |
| Compliance | Are OSCAL/certification gates in place? |
| Security | Is RBAC defined? Is there a threat model? |
| Observability | Are dashboards and alerts planned? |

**Generative Prompts for Leadership Evaluation:**
```
Imagine you are presenting this project to your VP next quarter.
Walk through the plan and ask:

1. "What numbers will I show to demonstrate value?"
   - If unclear → Gap: Metrics and baseline definition
   
2. "What will auditors ask about this system?"
   - Each question → Gap: Compliance artifact or certification gate
   
3. "What could go wrong that would embarrass us?"
   - Each risk → Gap: Security control or threat model
   
4. "How does this align with our platform strategy?"
   - If unclear → Gap: Strategic alignment documentation
   
5. "How will I know if this is working in production?"
   - If unclear → Gap: Observability (dashboards, alerts)
```

#### 5. Domain Expert (Project-Specific)
**Identify the primary beneficiary** of the project and add as 5th persona.

Examples:
- Incident Management → SRE/On-Call Engineer
- CI/CD → Release Engineer
- Security → Security Analyst
- Data → Data Engineer

**Generative Prompts for Domain Expert Evaluation:**
```
Imagine you are the primary beneficiary of this system.
First identify who that is, then ask:

1. "What domain knowledge does this plan assume I have?"
   - If significant → Gap: Domain glossary or onboarding
   
2. "What industry standards should this follow?"
   - Each standard → Verify plan aligns or document exception
   
3. "What existing workflows does this replace or integrate with?"
   - Each workflow → Gap: Migration path or integration spec
   
4. "What would make me distrust this system?"
   - Each concern → Gap: Validation, observability, or escape hatch
   
5. "What would I need to customize for my specific use case?"
   - Each item → Gap: Configuration, extension point, or docs
```

### Evaluation Template

```markdown
### Persona: [Name]

**Alignment Score:** X/10

| Aspect | Current Plan | Gap | Mitigation |
|--------|--------------|-----|------------|
| [Criteria 1] | What exists | What's missing | How to fix |
| [Criteria 2] | ... | ... | ... |

**Missing Skills for this Persona:**
- skill-name-1 - why needed
- skill-name-2 - why needed
```

---

## Phase 2: Gap Analysis

### 2.1 Knowledge Base Inventory

Scan all available skills and categorize by relevance:

```bash
# List project skills
ls .cursor/skills/

# List global skills
ls ~/.cursor/skills/
```

Create a matrix mapping skills to project phases:

| Skill | Phase 3 | Phase 4 | Phase 5 | Phase 6 |
|-------|---------|---------|---------|---------|
| test-driven-development | ✓ | ✓ | ✓ | ✓ |
| workflow-composition-standard | | ✓ | | |
| ... | | | | |

### 2.2 Missing Artifact Identification

For each category, identify what's missing:

#### Standards/Specs
- [ ] Are all integration APIs documented (OpenAPI specs)?
- [ ] Are data formats standardized?
- [ ] Are naming conventions defined (NIS-001)?

#### Skills
- [ ] Do skills exist for patterns being used?
- [ ] Are there gaps where manual work is repeated?
- [ ] Could a new skill prevent future friction?

#### Generators
- [ ] Is there repetitive scaffolding that could be automated?
- [ ] Do generators exist for the artifact types being created?

#### ADRs (Architecture Decision Records)
- [ ] Are significant architecture decisions documented?
- [ ] Is the rationale for technology choices captured?

#### Documentation
- [ ] Are operational procedures documented?
- [ ] Do runbooks exist for common scenarios?
- [ ] Is there an onboarding guide?

#### MCP/Tools
- [ ] Are all capabilities exposed via MCP?
- [ ] Is the tool manifest up to date?

### 2.3 Gap Prioritization

Classify gaps by impact and urgency:

| Priority | Criteria | Action |
|----------|----------|--------|
| P0 - Blocker | Prevents execution | Must resolve before starting |
| P1 - High | Significantly slows execution | Resolve as pre-work |
| P2 - Medium | Causes friction but workaroundable | Resolve during execution |
| P3 - Low | Nice to have | Defer to follow-up |

---

## Phase 3: Pre-Work Identification

### 3.1 Pre-Work Categories

#### Foundation Documents
- Severity/priority definitions
- Role and permission matrices
- SLA/SLO targets
- Glossary of terms

#### Reference Artifacts
- OpenAPI specs for integrations
- Sample data/fixtures
- Configuration templates
- Environment setup guides

#### Enabling Skills
- Skills that document patterns to be used
- Skills that capture institutional knowledge
- Skills that prevent repeated research

#### Architecture Records
- ADRs for significant decisions
- Sequence diagrams for complex flows
- Data flow diagrams

#### Sample Implementations
- Sample runbooks/playbooks
- Template configurations
- Example test cases

### 3.2 Pre-Work Template

For each pre-work item:

```markdown
### Pre-Work X.Y: [Title]

**Purpose:** Why this is needed
**Blocks:** Which phases/tasks depend on this
**Effort:** Estimated time/complexity
**Owner:** Who should create this

**Deliverable:**
- File path: `path/to/artifact`
- Format: markdown/json/typescript
- Key sections: [list]
```

### 3.3 Dependency Ordering

Pre-work items have dependencies on each other. Order them correctly:

#### Dependency Analysis Process

1. **List all pre-work items**
2. **For each item, ask:** "What other pre-work do I need to complete this?"
3. **Build dependency graph:**
   ```
   Item A → (no deps) → Execute first
   Item B → depends on A → Execute after A
   Item C → depends on A, B → Execute after A and B
   ```
4. **Identify parallelizable items:** Items with same or no dependencies

#### Dependency Matrix Template

```markdown
| Pre-Work Item | Depends On | Enables | Parallelizable With |
|---------------|------------|---------|---------------------|
| Severity definitions | None | Sample runbooks | OpenAPI specs |
| Sample runbooks | Severity defs | Testing | ADR |
| OpenAPI specs | None | Capabilities | Severity defs |
| Pattern skill | Implementation complete | Future projects | None |
```

#### Execution Order Algorithm

1. Execute all items with no dependencies (in parallel if possible)
2. Execute items that depend only on completed items
3. Repeat until all items complete

#### Common Dependency Patterns

| Pattern | Description |
|---------|-------------|
| **Foundation first** | Definitions → Specs → Samples → Skills |
| **Spec-driven** | OpenAPI/Schema → Implementation → Tests |
| **Knowledge capture** | Implementation → Retrospective → Skill creation |

---

## Phase 4: Retrospective Integration

Every todo should have a retrospective checkpoint. Use the `retrospective` skill.

### Checkpoint Cadence

| Scope | Checkpoint Type | Location |
|-------|-----------------|----------|
| After each todo | Mini checkpoint | `/retrospectives/checkpoints/` |
| After each phase | Full retrospective | `/retrospectives/sessions/` |
| After project | Comprehensive retro | `/retrospectives/sessions/` |

### Checkpoint Content

```markdown
## Progress
- [x] Completed: [description]

## Learnings
- What worked well
- What was harder than expected

## Friction
- Missing tools/patterns
- Documentation gaps
- Unclear requirements

## Opportunities
- Skills to create
- Generators to build
- Patterns to document
```

### Pattern Tracking

After each retrospective:
1. Check `/retrospectives/PATTERNS.md` for recurring issues
2. Add new patterns with occurrence count
3. Graduate patterns (≥3 occurrences) to formal solutions

---

## Phase 5: Success Metrics Definition

For each persona, define measurable success criteria:

| Persona | Metric | Target | How to Measure |
|---------|--------|--------|----------------|
| Agent | Tool discovery rate | 100% | MCP manifest audit |
| Developer | Generator usage | >80% | Git history analysis |
| End User | Task completion time | Baseline -X% | Observability metrics |
| Leadership | Compliance score | 100% | Certification gates |
| Domain Expert | [Domain-specific] | [Target] | [Method] |

---

## Output Artifacts

This skill produces:

1. **Persona Evaluation Matrix** - Alignment scores and gaps per persona
2. **Skills Integration Matrix** - Skills mapped to phases
3. **Gap Analysis Report** - Prioritized list of missing artifacts
4. **Pre-Work Plan** - Ordered list of foundation work
5. **Success Metrics** - Measurable criteria per persona

---

## Phase 6: Post-Implementation Reflection

After completing the plan, update this skill based on learnings.

### Reflection Triggers

Update the skill when:
- A gap was discovered mid-implementation that wasn't caught by Phase 1-3
- A persona evaluation question would have caught a problem earlier
- Pre-work ordering caused delays
- External research was needed that wasn't anticipated

### Reflection Template

```markdown
## SPP-001 Usage Reflection

**Project:** [name]
**Date:** [date]

### What Worked Well
- [Effective aspects of the skill]

### What Was Missing
| Gap | What Happened | Skill Update |
|-----|---------------|--------------|
| [Missing question/check] | [Problem that occurred] | Add to Phase [X] |

### Scoring Calibration
- Were scores accurate predictors of success?
- Were thresholds appropriate?
- Adjustments: [if any]

### New Patterns Discovered
- [Patterns worth adding to the skill]

### Prompts to Add
| Persona | New Prompt | Why Needed |
|---------|------------|------------|
| [persona] | "[question]" | [problem it would catch] |
```

### Updating the Skill

1. **Add new prompts** to relevant persona sections
2. **Add new checklist items** to gap analysis
3. **Add new categories** to pre-work identification
4. **Update scoring rubric** if calibration is off
5. **Add to examples** in pre-work planning guide

---

## Quick Reference Checklist

Before executing any plan:

- [ ] External knowledge assessed (Phase 0)
- [ ] Evaluated from 5 personas (Agent, Developer, End User, Leadership, Domain Expert)
- [ ] All alignment scores ≥6/10 (or gaps mitigated)
- [ ] Relevant skills identified and read
- [ ] Missing skills identified for creation
- [ ] Gap analysis complete (Standards, Skills, Generators, ADRs, Docs, MCP)
- [ ] Pre-work items identified and prioritized
- [ ] Pre-work dependencies mapped and ordered
- [ ] Retrospective checkpoints scheduled
- [ ] Success metrics defined per persona
- [ ] Retrospectives directory structure verified

After executing the plan:

- [ ] Post-implementation reflection completed
- [ ] Skill updated with learnings (if applicable)

---

## Related Skills

- `retrospective` - Checkpoint and retrospective protocols
- `usecase-refinement-protocol` - Refine ambiguous requirements
- `architect-workflow-logic` - Design workflow architectures
- `test-driven-development` - TDD practices
- `docs-with-mermaid` - Documentation with diagrams

---

## References

- [Persona Evaluation Template](references/persona-evaluation-template.md)
- [Gap Analysis Checklist](references/gap-analysis-checklist.md)
- [Pre-Work Planning Guide](references/pre-work-planning-guide.md)
