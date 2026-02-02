# Persona Evaluation Template

Use this template to evaluate a plan from each of the 5 required personas.

## Scoring Rubric

| Score | Meaning | Criteria |
|-------|---------|----------|
| 9-10 | **Excellent** | All needs addressed, patterns documented, no gaps identified |
| 7-8 | **Good** | Most needs addressed, minor gaps can be resolved during execution |
| 5-6 | **Adequate** | Core needs addressed, but significant gaps require pre-work |
| 3-4 | **Weak** | Major concerns, substantial pre-work or plan revision needed |
| 1-2 | **Poor** | Fundamental misalignment, plan needs significant rethinking |

---

## Persona 1: Agent (AI Assistant)

**Alignment Score:** _/10

### Evaluation

| Aspect | Current Plan | Gap | Mitigation |
|--------|--------------|-----|------------|
| Tool Discovery | | | |
| Determinism | | | |
| Context Propagation | | | |
| HITL Clarity | | | |

### Generative Prompts

Walk through each phase as if you are an AI agent. Ask:

1. **"When a user asks me to [action], what tool do I invoke?"**
   - If unclear → Gap: MCP registration or tool naming

2. **"What information do I need to pass to each capability?"**
   - If unclear → Gap: Schema documentation or aiHints

3. **"If something fails mid-workflow, can I retry safely?"**
   - If no → Gap: Idempotency or determinism violation

4. **"When do I need human approval before proceeding?"**
   - If unclear → Gap: HITL signal definitions

5. **"How do I know if the operation succeeded?"**
   - If unclear → Gap: Output schema or status indicators

### Key Questions
- Are all new capabilities registered in the MCP manifest?
- Will the sync generator pick up new artifacts?
- Is workflow code deterministic (no Date, Math.random, setTimeout)?
- Are approval signals clearly defined?
- Is GoldenContext extended and propagated correctly?

### Missing Skills for Agent Persona
- [ ] _skill-name_ - _why needed_

---

## Persona 2: Developer (Platform Contributor)

**Alignment Score:** _/10

### Evaluation

| Aspect | Current Plan | Gap | Mitigation |
|--------|--------------|-----|------------|
| Dogfooding | | | |
| Clear Patterns | | | |
| Fast Feedback | | | |
| Minimal Boilerplate | | | |

### Generative Prompts

Walk through as a new developer implementing a similar feature. Ask:

1. **"What patterns will I use that aren't documented?"**
   - If any → Gap: Skill creation needed

2. **"What files will I create more than twice?"**
   - If any → Gap: Generator needed

3. **"How will I know if my code follows the standards?"**
   - If unclear → Gap: Linting rules or TDD guidance

4. **"Where will I get stuck waiting for information?"**
   - Each wait → Gap: Documentation or spec needed

5. **"What would I copy-paste from this implementation?"**
   - Each item → Gap: Should be a pattern, not copy-paste

### Key Questions
- Did we use platform patterns to build this feature?
- Are the patterns documented in skills?
- Do tests run quickly with good coverage?
- Are generators available for repetitive scaffolding?

### Missing Skills for Developer Persona
- [ ] _skill-name_ - _why needed_

---

## Persona 3: End User (Platform Operator)

**Alignment Score:** _/10

### Evaluation

| Aspect | Current Plan | Gap | Mitigation |
|--------|--------------|-----|------------|
| Usability | | | |
| Response Speed | | | |
| Clear Workflows | | | |
| Minimal Training | | | |

### Generative Prompts

Walk through as an SRE at 3am trying to use this system. Ask:

1. **"What will I click/type to accomplish the main task?"**
   - If unclear → Gap: UX design or user flow needed

2. **"How long will I wait for results?"**
   - If unknown → Gap: SLO definition needed

3. **"What do I do if it doesn't work?"**
   - If unclear → Gap: Error handling or troubleshooting guide

4. **"How will I learn to use this without reading code?"**
   - If can't → Gap: User documentation needed

5. **"What will confuse me about the terminology?"**
   - Each term → Gap: Glossary or tooltips needed

### Key Questions
- Is the UI intuitive for the target user?
- Are UX mockups or user flows defined?
- Are SLOs/performance targets specified?
- Do runbooks/playbooks exist?
- Is there an onboarding guide?

### Missing Skills for End User Persona
- [ ] _skill-name_ - _why needed_

---

## Persona 4: Platform Engineering Leadership

**Alignment Score:** _/10

### Evaluation

| Aspect | Current Plan | Gap | Mitigation |
|--------|--------------|-----|------------|
| ROI | | | |
| Compliance | | | |
| Security | | | |
| Strategic Alignment | | | |
| Observability | | | |

### Generative Prompts

Walk through as if presenting to your VP next quarter. Ask:

1. **"What numbers will I show to demonstrate value?"**
   - If unclear → Gap: Metrics and baseline definition

2. **"What will auditors ask about this system?"**
   - Each question → Gap: Compliance artifact or certification gate

3. **"What could go wrong that would embarrass us?"**
   - Each risk → Gap: Security control or threat model

4. **"How does this align with our platform strategy?"**
   - If unclear → Gap: Strategic alignment documentation

5. **"How will I know if this is working in production?"**
   - If unclear → Gap: Observability (dashboards, alerts)

### Key Questions
- What metrics demonstrate business value?
- Is baseline captured for comparison?
- Are OSCAL/certification gates defined?
- Is RBAC designed? Is there a threat model?
- Does this align with platform strategy?
- Are dashboards and alerts planned?

### Missing Skills for Leadership Persona
- [ ] _skill-name_ - _why needed_

---

## Persona 5: Domain Expert (_____________)

**Role:** _____________ (e.g., SRE, Release Engineer, Security Analyst)

**Why this persona:** _Explain why they are the primary beneficiary_

**Alignment Score:** _/10

### Evaluation

| Aspect | Current Plan | Gap | Mitigation |
|--------|--------------|-----|------------|
| _Domain-specific 1_ | | | |
| _Domain-specific 2_ | | | |
| _Domain-specific 3_ | | | |
| _Domain-specific 4_ | | | |

### Generative Prompts

Walk through as the primary beneficiary of this system. Ask:

1. **"What domain knowledge does this plan assume I have?"**
   - If significant → Gap: Domain glossary or onboarding

2. **"What industry standards should this follow?"**
   - Each standard → Verify plan aligns or document exception

3. **"What existing workflows does this replace or integrate with?"**
   - Each workflow → Gap: Migration path or integration spec

4. **"What would make me distrust this system?"**
   - Each concern → Gap: Validation, observability, or escape hatch

5. **"What would I need to customize for my specific use case?"**
   - Each item → Gap: Configuration, extension point, or docs

### Key Questions
- _Domain-specific question 1_
- _Domain-specific question 2_
- _Domain-specific question 3_

### Missing Skills for Domain Expert Persona
- [ ] _skill-name_ - _why needed_

---

## Summary

| Persona | Score | Critical Gaps | Mitigation Priority |
|---------|-------|---------------|---------------------|
| Agent | /10 | | |
| Developer | /10 | | |
| End User | /10 | | |
| Leadership | /10 | | |
| Domain Expert | /10 | | |

**Overall Readiness:** _Ready / Needs Pre-Work / Needs Rethink_

---

## Recommended Pre-Work

Based on gap analysis:

1. **P0 (Blocker):**
   - 

2. **P1 (High):**
   - 

3. **P2 (Medium):**
   - 

4. **P3 (Low):**
   - 
