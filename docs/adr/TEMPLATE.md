# ADR-XXX: [Short Title of Decision]

| Metadata | Value |
| --- | --- |
| ID | ADR-XXX |
| Version | 1.0.0 |
| Status | PROPOSED |
| Authors | [Your Name/Team] |
| Date | YYYY-MM-DD |
| Context | [Brief context phrase] |
| Supersedes | — |

---

## 1. Decision Summary

[One paragraph summarizing what decision is being made and why it matters.]

---

## 2. Context & Problem Statement

### 2.1 Current State

- [Bullet points describing the current situation]
- [Pain points or gaps that motivate this decision]

### 2.2 Desired State

- [What we want to achieve]
- [Expected improvements]

---

## 3. Decision Drivers

| Driver | Weight | Rationale |
|--------|--------|-----------|
| [Driver 1] | High/Medium/Low | [Why this matters] |
| [Driver 2] | High/Medium/Low | [Why this matters] |

---

## 4. Proposed Solution

[Detailed description of the chosen approach. Include:]

- Architecture diagrams (use Mermaid)
- Data schemas (TypeScript/JSON Schema)
- API contracts
- Configuration examples

### 4.1 [Component/Aspect 1]

```typescript
// Example code or schema
```

### 4.2 [Component/Aspect 2]

[Description and examples]

---

## 5. Alternatives Considered

### 5.1 [Alternative 1 Name]

| Pros | Cons |
|------|------|
| [Advantage] | [Disadvantage] |

**Decision:** [Why rejected]

### 5.2 [Alternative 2 Name]

| Pros | Cons |
|------|------|
| [Advantage] | [Disadvantage] |

**Decision:** [Why rejected]

---

## 6. Consequences

### 6.1 Positive

- [Benefit 1]
- [Benefit 2]

### 6.2 Negative

- [Drawback 1 and mitigation]
- [Drawback 2 and mitigation]

### 6.3 Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| [Risk 1] | Low/Medium/High | Low/Medium/High | [How to address] |

---

## 7. Verification

### 7.1 Unit Tests

```bash
# Commands to run unit tests
pnpm nx test [package] --grep="[pattern]"
```

### 7.2 Integration Tests

```bash
# Commands to run integration tests
pnpm nx e2e [package] --grep="[pattern]"
```

### 7.3 Acceptance Criteria

- [ ] [Criterion 1]
- [ ] [Criterion 2]
- [ ] [Criterion 3]

---

## 8. References

- [Link to related documentation]
- [Link to external resources]
- Internal: [Link to internal standards or skills]

---

## 9. Changelog

### 1.0.0 (YYYY-MM-DD)

- Initial ADR
