---
name: typescript-expert
description: TypeScript best practices for safe, maintainable code (narrowing, discriminated unions, runtime validation at boundaries, and minimal `any`).
---

# TypeScript Expert

Use this skill for any TypeScript work, especially when types are non-trivial or correctness matters.

## Core Principles

- **Types are not validation**: validate inputs at boundaries (HTTP, CLI, DB).
- **Prefer explicit domain types** over primitive soup (e.g. `IncidentId`).
- **Make invalid states unrepresentable** using unions and narrow types.
- **Avoid `any`**; prefer `unknown` + narrowing.

## Patterns to Prefer

### Discriminated unions

- Use a `type`/`kind` field to make exhaustive switching safe.
- Always include an `assertNever` helper for exhaustiveness.

### Narrow early

- Parse, validate, and narrow at the boundary; pass **typed** values inward.

### Stable interfaces

- Keep shared types in shared packages; keep runtime deps out of domain/application layers.

## Anti-Patterns

- `as SomeType` to silence errors without proving correctness.
- Optional chains masking invalid object shapes.
- `Date.now()` / random IDs in deterministic workflows (unless injected).

## Refactor Checklist

- Remove duplicate types; centralize source-of-truth shapes.
- Replace `string` IDs with branded types where helpful.
- Add `satisfies` where appropriate to avoid widening.

