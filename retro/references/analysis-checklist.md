# Analysis Checklist

Systematic checklist for identifying improvement opportunities in a codebase.

---

## Quick Analysis (10 minutes)

Use for checkpoint analysis or quick reviews.

### Code Health
- [ ] Any files > 500 lines? → Candidate for splitting
- [ ] Any functions > 50 lines? → Candidate for extraction
- [ ] Any recent TODO/FIXME added? → Review for action

### Testing
- [ ] Did you add tests for new code? → If not, note the gap
- [ ] Are there obvious untested paths? → Note them

### Documentation
- [ ] Does new code have comments where needed?
- [ ] Are there any outdated comments?

---

## Deep Analysis (30-60 minutes)

Use for full retrospectives or periodic reviews.

### 1. Code Quality

#### DRY Violations
_Duplicated code that should be abstracted._

```bash
# Find similar file names (potential duplication)
find packages -name "*.ts" | xargs -I {} basename {} | sort | uniq -c | sort -rn | head -10

# Find repeated patterns
grep -rn "function.*factory" packages/ --include="*.ts"
```

- [ ] Check for copy-pasted code blocks
- [ ] Look for similar schemas defined in multiple places
- [ ] Identify repeated utility functions

**Findings:**
_Document any DRY violations found._

#### Pattern Inconsistencies
_Similar things done differently across the codebase._

- [ ] Naming conventions consistent?
- [ ] Error handling patterns consistent?
- [ ] Import styles consistent?
- [ ] Test structure consistent?

**Findings:**
_Document any inconsistencies found._

#### Dead Code
_Unused exports, unreachable paths._

```bash
# Find exports (manual review needed)
grep -rn "export " packages/ --include="*.ts" | head -50

# Find unused dependencies
pnpm why <package-name>
```

- [ ] Any exports not imported elsewhere?
- [ ] Any functions never called?
- [ ] Any feature flags for removed features?

**Findings:**
_Document any dead code found._

---

### 2. Testing

#### Coverage Analysis

```bash
# Run with coverage (if configured)
pnpm nx run-many --target=test --coverage

# Find files without tests
find packages -name "*.ts" ! -name "*.test.ts" ! -name "*.spec.ts" -exec basename {} \; | \
  while read f; do 
    if ! find packages -name "${f%.ts}.test.ts" -o -name "${f%.ts}.spec.ts" | grep -q .; then 
      echo "Missing test: $f"; 
    fi
  done
```

- [ ] Critical paths tested?
- [ ] Error cases tested?
- [ ] Edge cases tested?

**Findings:**
_Document testing gaps found._

#### Test Quality

- [ ] Tests actually assert meaningful things?
- [ ] Tests isolated (no cross-test dependencies)?
- [ ] Tests readable (intention clear)?
- [ ] Mocks appropriate (not over-mocking)?

**Findings:**
_Document test quality issues found._

---

### 3. Documentation

#### Staleness Check

- [ ] README still accurate?
- [ ] API docs match implementation?
- [ ] Skills reference correct file paths?
- [ ] ADRs still reflect current state?

**Findings:**
_Document stale docs found._

#### Missing Documentation

- [ ] Public APIs documented?
- [ ] Complex logic explained?
- [ ] Architectural decisions captured in ADRs?
- [ ] Domain knowledge captured in skills?

**Findings:**
_Document missing docs._

---

### 4. Developer Experience

#### Workflow Friction

- [ ] Any repetitive manual processes?
- [ ] Any missing scripts or automations?
- [ ] Any slow feedback loops?

**Findings:**
_Document workflow friction._

#### Error Messages

- [ ] Error messages actionable?
- [ ] Stack traces useful?
- [ ] Failure modes documented?

**Findings:**
_Document error message issues._

#### Onboarding

- [ ] Can a new agent understand this code quickly?
- [ ] Are there missing "getting started" docs?
- [ ] Are there tribal knowledge gaps?

**Findings:**
_Document onboarding issues._

---

### 5. Architecture

#### Coupling

- [ ] Components have clear boundaries?
- [ ] Dependencies flow in one direction?
- [ ] Changes in one area don't cascade?

**Findings:**
_Document coupling issues._

#### Abstraction Leaks

- [ ] Implementation details hidden?
- [ ] Interfaces stable?
- [ ] Internal types not exported?

**Findings:**
_Document abstraction leaks._

---

## Analysis Summary

After completing the checklist, summarize:

### Critical Issues (Address Now)
1. [Issue and recommended action]
2. [Issue and recommended action]

### Important Issues (Address Soon)
1. [Issue and recommended action]
2. [Issue and recommended action]

### Minor Issues (Backlog)
1. [Issue and recommended action]
2. [Issue and recommended action]

### Positives (Keep Doing)
1. [Good pattern to preserve]
2. [Good pattern to preserve]
