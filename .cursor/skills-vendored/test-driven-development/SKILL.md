---
name: test-driven-development
description: Write the smallest failing test first, then implement the minimum change to pass, then refactor. Prefer deterministic, isolated tests and contract tests at boundaries.
---

# Test-Driven Development (TDD)

Use this skill any time you are implementing a feature, bugfix, refactor, or script that can be verified.

## Rules of TDD (Harmony-flavored)

1. **Red**: Write a focused test that fails for the right reason.
2. **Green**: Make the smallest change to pass the test.
3. **Refactor**: Improve structure without changing behavior; keep tests green.

## What to Test First

- **Behavior contracts**: What must be true from the user’s perspective?
- **Edge cases**: Empty inputs, missing files, invalid params, permission errors.
- **Determinism**: Tests must not depend on time, network, random IDs, or machine-specific paths unless explicitly controlled.

## Harmony Practices

- **Prefer boundary tests**:
  - CLI/script: spawn the process with controlled env + temp dirs.
  - API: route tests against an in-memory server / test DB fixture.
- **Prefer pure units**:
  - Extract parsing/validation into pure functions and test them directly.
- **Avoid flake**:
  - Use temp directories and controlled environment variables.
  - Never rely on developer home directory unless the test sets `HOME`.

## Test Checklist

- The test name describes **purpose**, not implementation.
- Each test verifies **one** behavior.
- Failures are **actionable** (clear assertions, clear error messages).
- Tests are fast enough to run locally and in CI.

