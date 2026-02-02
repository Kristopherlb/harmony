---
name: shadcn-ui
description: Guidance for working with shadcn/ui components (composition-first, accessible primitives, consistent variants).
---

# shadcn/ui

Use this skill when implementing UI using shadcn/ui patterns.

## Principles

- Prefer **composition** over bespoke components.
- Keep variants consistent (size, intent, disabled, loading).
- Ensure accessible defaults (labels, aria, focus rings).

## Practical Guidance

- Prefer existing primitives (Button, Dialog, DropdownMenu) over reimplementing.
- Keep className merges predictable; do not over-nest conditionals.
- Avoid introducing design drift; reuse existing tokens/utility classes.

