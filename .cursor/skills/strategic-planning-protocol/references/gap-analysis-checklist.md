# Gap Analysis Checklist

Use this checklist to systematically identify missing artifacts before executing a plan.

---

## 0. External Knowledge Assessment

Before diving into internal gaps, assess external research needs:

### Research Triggers

- [ ] Does this use frameworks/patterns not in the codebase?
- [ ] Does this integrate with services I haven't used?
- [ ] Is this the first implementation of a new capability type?
- [ ] Are there security/compliance requirements I'm uncertain about?
- [ ] Has the underlying technology changed recently?

### Research Actions

| Topic | Question | Source | Status |
|-------|----------|--------|--------|
| [Framework] | How to implement X? | Docs/examples | [ ] Done |
| [Integration] | How does Y API work? | OpenAPI/tutorials | [ ] Done |
| [Best Practice] | Current standard for Z? | Web search | [ ] Done |

### Confidence After Research

| Area | Confidence | Notes |
|------|------------|-------|
| Implementation approach | Low/Medium/High | |
| Integration feasibility | Low/Medium/High | |
| Security posture | Low/Medium/High | |

---

## 1. Standards and Specifications

### API Specifications
- [ ] OpenAPI/Swagger specs available for all external integrations
- [ ] GraphQL schemas documented (if applicable)
- [ ] gRPC proto files available (if applicable)
- [ ] Webhook payload schemas documented

### Data Standards
- [ ] Data classification levels defined (CSS-001)
- [ ] PII handling procedures documented
- [ ] Retention policies specified
- [ ] Data flow diagrams created

### Naming Standards
- [ ] Canonical ID format defined (NIS-001)
- [ ] File/directory naming conventions documented
- [ ] API endpoint naming conventions established
- [ ] Event naming conventions specified

### Questions to Ask
- What external APIs will we integrate with?
- Are there existing specs we can reference?
- What data will flow through the system?

---

## 2. Skills

### Existing Skills Audit
- [ ] Listed all project skills (`.cursor/skills/`)
- [ ] Listed all global skills (`~/.cursor/skills/`)
- [ ] Mapped skills to project phases
- [ ] Identified which skills to read before starting

### Missing Skills Identification
- [ ] Patterns used but not documented as skills
- [ ] Repeated research that should be captured
- [ ] Complex procedures that need step-by-step guidance
- [ ] Integration patterns that would help agents

### Skill Categories to Consider
| Category | Example Skills | Check |
|----------|----------------|-------|
| Architecture | clean-architecture, architecture-patterns | [ ] |
| Testing | test-driven-development | [ ] |
| Workflows | temporal-io, workflow-composition-standard | [ ] |
| UI/UX | shadcn-ui, ui-ux-pro-max | [ ] |
| Documentation | docs-with-mermaid | [ ] |
| Compliance | certification-and-audit, oscal-compliance | [ ] |
| Security | unified-identity-model | [ ] |
| Observability | golden-observability | [ ] |

### Questions to Ask
- What patterns will we use repeatedly?
- What knowledge do I need that I don't have?
- What would help future developers/agents?

---

## 3. Generators

### Existing Generators Audit
- [ ] Listed all Nx generators (`tools/path/generators.json`)
- [ ] Identified which generators apply to this project
- [ ] Verified generators are working

### Missing Generators Identification
- [ ] Repetitive scaffolding that could be automated
- [ ] Boilerplate patterns that appear multiple times
- [ ] File structures that need consistency

### Generator Categories to Consider
| Category | What It Generates | Exists? |
|----------|-------------------|---------|
| Capability | OCS-compliant capability files | [ ] |
| Blueprint | WCS-compliant workflow files | [ ] |
| Component | UI component scaffolding | [ ] |
| Test | Test file scaffolding | [ ] |
| HITL Gate | Approval signal infrastructure | [ ] |
| Context Extension | GoldenContext extensions | [ ] |
| Webhook Handler | Integration webhook handlers | [ ] |

### Questions to Ask
- What files will I create more than twice?
- What patterns need to be consistent?
- What would I wish was automated?

---

## 4. Architecture Decision Records (ADRs)

### Existing ADRs Audit
- [ ] Listed all existing ADRs (`docs/adr/`)
- [ ] Identified relevant ADRs for this project
- [ ] Verified ADRs are up to date

### Missing ADRs Identification
- [ ] Significant technology choices not documented
- [ ] Architecture patterns not explained
- [ ] Trade-off decisions not captured
- [ ] Integration strategies not documented

### ADR Topics to Consider
| Topic | Question | ADR Needed? |
|-------|----------|-------------|
| Orchestration | Why Temporal vs. alternatives? | [ ] |
| Authentication | Why Keycloak/OIDC? | [ ] |
| Storage | Why this database? | [ ] |
| Messaging | Why this queue/broker? | [ ] |
| Integration | Why these external services? | [ ] |
| UI Framework | Why React/Vue/etc.? | [ ] |

### Questions to Ask
- What decisions might someone question later?
- What alternatives did we consider?
- What constraints drove our choices?

---

## 5. Documentation

### Operational Documentation
- [ ] Runbooks for common scenarios
- [ ] Playbooks for incident types
- [ ] Troubleshooting guides
- [ ] On-call procedures

### User Documentation
- [ ] Getting started guide
- [ ] Feature documentation
- [ ] API reference
- [ ] FAQ

### Developer Documentation
- [ ] Architecture overview
- [ ] Contributing guide
- [ ] Local development setup
- [ ] Testing guide

### Questions to Ask
- How will operators use this system?
- How will users learn the system?
- How will new developers get started?

---

## 6. MCP/Tool Infrastructure

### Tool Registration
- [ ] All capabilities registered in MCP manifest
- [ ] Tool descriptions are clear and accurate
- [ ] Input/output schemas are complete
- [ ] Examples are provided

### Discovery
- [ ] Sync generator runs correctly
- [ ] New artifacts are discoverable
- [ ] Search/filter works for new tools

### Questions to Ask
- Will agents find these capabilities?
- Are tool descriptions helpful for LLMs?
- Is the manifest up to date?

---

## 7. Testing Infrastructure

### Test Types
- [ ] Unit tests for business logic
- [ ] Integration tests for workflows
- [ ] Contract tests for capabilities
- [ ] E2E tests for critical paths

### Test Fixtures
- [ ] Sample data available
- [ ] Mock services configured
- [ ] Test environments documented

### Questions to Ask
- What should be tested?
- What test infrastructure exists?
- What fixtures do we need?

---

## 8. Configuration and Secrets

### Configuration
- [ ] Feature flags defined
- [ ] Environment variables documented
- [ ] Configuration templates created

### Secrets
- [ ] Secret requirements identified
- [ ] Secret naming follows ISS-001
- [ ] Secret injection method documented

### Questions to Ask
- What configuration will change between environments?
- What secrets are required?
- How will secrets be injected?

---

## Summary Matrix

| Category | Items Checked | Gaps Found | Priority |
|----------|---------------|------------|----------|
| Standards/Specs | /X | | |
| Skills | /X | | |
| Generators | /X | | |
| ADRs | /X | | |
| Documentation | /X | | |
| MCP/Tools | /X | | |
| Testing | /X | | |
| Config/Secrets | /X | | |

---

## Gap Prioritization

### P0 - Blockers (Must resolve before starting)
- 

### P1 - High (Resolve as pre-work)
- 

### P2 - Medium (Resolve during execution)
- 

### P3 - Low (Defer to follow-up)
- 
