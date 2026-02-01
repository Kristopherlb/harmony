# Design System Exceptions

This document lists documented exceptions to design system enforcement rules.

## Raw `<button>` Usage

The following are allowed exceptions for raw `<button>` elements:

1. **Radix UI internals**: Components that use Radix primitives may contain raw `<button>` elements as part of their internal implementation. These are not exposed as app UI.

2. **Test files**: Test files may use raw `<button>` for testing purposes.

3. **Documented exceptions**: Any usage marked with `// EXCEPTION:` comment explaining why a raw button is necessary.

## Hard-coded Colors

The following are allowed exceptions for hard-coded color utilities:

1. **Test files**: Test files may use hard-coded colors for testing.

2. **One-off decorative elements**: Deliberate one-off color usage that is documented and not part of semantic UI patterns.

3. **Legacy code in migration**: Code that is actively being migrated (marked with TODO comments).

## Inline Component Definitions

The following are allowed exceptions for inline component definitions in pages:

1. **Local helpers < 30 lines**: Tiny helper components used only once in a page, under 30 lines, with no styling branching.

2. **Test utilities**: Test-specific helper components.

## Status/Health Colors

All status and health indicators must use semantic tokens. No exceptions.
