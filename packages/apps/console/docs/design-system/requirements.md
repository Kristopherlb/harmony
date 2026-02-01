# Design System Requirements (Asset Manager)

These requirements define the foundations, component architecture, composition patterns, documentation, and governance for a single reusable design system for the `client/` React application.

## 1) Goals
- Single source of truth for UI foundations (tokens), components (primitives), and reusable patterns.
- Container-first architecture: routes/pages orchestrate; reusable components render.
- Eliminate duplicate “button types” and other duplicated primitives via canonical components + variants.
- Improve accessibility and consistency across dense NOC-style UI screens (desktop + mobile).

## 2) Non-goals
- A visual redesign of the product.
- Replacing Radix/Shadcn primitives already adopted.
- Re-architecting server-side code unless necessary for type sharing.

## 3) Current Constraints (repo reality)
- UI stack: React 18 + Tailwind + Radix + Shadcn patterns + `class-variance-authority` (CVA).
- Canonical primitives live in `client/src/components/ui/*` (already present).
- Tokens live as CSS variables in `client/src/index.css` and are mapped in `tailwind.config.ts`.
- Theme switching is implemented via `client/src/components/theme-provider.tsx` (`light` / `dark`).

## 4) Definitions
- **Foundation**: tokens + global behaviors (typography scale, spacing scale, elevation, motion).
- **Token**: named design value expressed as CSS variable(s).
- **Primitive**: generic, reusable UI building block in `client/src/components/ui/*`.
- **Pattern**: reusable composition built from primitives (EmptyState, FilterBar, MetricCard).
- **Feature component**: reusable building block within a domain area (ServiceCard, ActionPanel).
- **Container**: orchestrates data/routing/state; composes view/patterns; minimal markup.
- **View**: presentational composition; props-in/handlers-out; no routing and no data fetching.

## 5) Architecture (Clean boundaries for UI)
### 5.1 Layering
Treat UI layers like Clean Architecture (stable core inward):
- **Foundation + Design System Core (most stable)**: tokens + `client/src/components/ui/*`
- **Patterns + Feature Components**: reusable composition for product UI
- **Routes/Screens (most volatile)**: `client/src/pages/*` containers

Dependency direction:
- Pages can import anything.
- Patterns/features can import primitives + other patterns/features.
- Primitives must not import pages or feature modules.

### 5.2 Target directory structure (incremental end-state)
```
client/src/
  components/
    ui/                     # primitives (design system core)
    layout/                 # app shell, page frames, responsive grids
    patterns/               # reusable patterns (EmptyState, SectionHeader, MetricCard)
  features/
    <feature>/
      components/           # feature components (reusable within feature)
      view/                 # pure presentational composition
      hooks/                # feature hooks (optional)
  pages/                    # route-level containers
```

Naming requirements:
- `client/src/components/ui/*`: lowercase filenames (Shadcn convention).
- Everything else: `PascalCase` filenames.
- Containers end in `Page` (routes) or `Container` (non-route orchestrators).

## 6) Foundation Requirements (Tokens, Theming, Motion)
### 6.1 Token hierarchy (required)
All new tokens must follow a 3-layer hierarchy:
1) **Primitive tokens** (raw values): palette values, spacing steps, radii steps
2) **Semantic tokens** (meaning): surface/text/border/interactive/status roles
3) **Component tokens** (specific): `--button-*`, `--card-*` only when necessary

The current token set in `client/src/index.css` acts as the semantic layer; future additions must not skip hierarchy without justification.

### 6.2 Token naming conventions
- CSS vars use kebab-case: `--surface-1`, `--text-primary`, `--border-default`.
- Token names must be semantic (purpose-based), not page/feature-specific.
- Every token must define both light + dark values.

### 6.3 Tailwind mapping and usage rules
- Tailwind semantic classes must map to tokens (`tailwind.config.ts`).
- Product code must use semantic classes (`bg-card`, `text-muted-foreground`, `border-border`).
- Prohibited: hard-coded color utilities for core UI (e.g., `bg-emerald-500`) unless the value is a deliberate one-off and documented.

### 6.4 Status/state colors
If color encodes meaning (health, severity, status), it must be standardized:
- Prefer semantic tokens or the `status.*` palette in Tailwind.
- Feature code must not invent new severity palettes in-line.

### 6.5 Typography + spacing + elevation
The design system must define (and document) a single scale for:
- **Typography**: size steps, weights, line heights
- **Spacing**: base unit and steps (e.g., 4px scale)
- **Radii**: reuse Tailwind radius tokens
- **Elevation**: reuse existing `--elevate-*`/shadow tokens and document when to use each

### 6.6 Motion and interaction
- Respect reduced-motion preferences for animations with meaningful motion.
- Interaction states must be consistent: hover, active, focus-visible, disabled.

## 7) Primitive Component Requirements (Design System Core)
### 7.1 General primitive standards
All primitives in `client/src/components/ui/*` must:
- Use Radix primitives where relevant for accessibility.
- Use `cn` for class merging and CVA for variants where styling branches.
- Forward refs where appropriate (inputs, buttons, triggers).
- Be token-driven (no feature-specific styling).
- Have stable, typed props (avoid `any`, avoid leaking Radix internals unless needed).

### 7.2 The “one Button” rule (non-negotiable)
`client/src/components/ui/button.tsx` is the only canonical Button primitive.

Prohibited:
- Creating additional `Button` implementations anywhere else.
- Defining another “primary”/“secondary” button via copied CVA logic.
- Using raw `<button>` for standard app actions.

Allowed (documented exception):
- Internals of primitives (e.g., Radix triggers) when not exposed as app UI.
- Purpose-built controls where `Button` is not the correct abstraction (Toggle, Tabs, Slider).

### 7.3 Extending Button (variants or composition only)
Any new “button type” must be implemented as:
- A `variant`/`size` added to `buttonVariants`, or
- A wrapper component that composes `Button` without redefining styling logic.

Wrapper requirements:
- Wrapper must pass through `variant`, `size`, `asChild`, and `className`.
- Wrapper must not hard-code core colors/typography; use variants/tokens.

### 7.4 Canonical primitives inventory
The design system must maintain a documented list of primitives (existing ones count) with a “do not duplicate” policy:
- Actions: `Button`, `DropdownMenu`, `ContextMenu`, `Menubar`
- Layout: `Card`, `Separator`, `ScrollArea`, `Resizable`
- Inputs: `Input`, `Textarea`, `Select`, `Checkbox`, `RadioGroup`, `Switch`, `Slider`, `Calendar`
- Feedback: `Alert`, `Toast/Toaster`, `Progress`, `Skeleton`, `Tooltip`, `HoverCard`, `Dialog/Sheet/Drawer`
- Navigation: `Breadcrumb`, `Tabs`, `Pagination`, `NavigationMenu`, `Sidebar`

## 8) Pattern + Feature Layer Requirements (Composition)
### 8.1 Container decomposition (“containers are orchestration”)
Pages in `client/src/pages/*` must follow this rule:
- Containers orchestrate data, routing, and state.
- Containers must not contain large presentational trees when the UI can be reused or tested separately.

Required triggers for decomposition:
- > ~250 lines of JSX + UI helpers.
- A pattern appears in 2+ places (headers, cards, toolbars, empty states, status pills).
- A section has non-trivial interactions (selection, sorting, optimistic updates).

### 8.2 Composition contract (what makes a component reusable)
Patterns/feature components must:
- Be props-driven (no implicit data loading; no routing hooks).
- Accept `className` for layout only (grid/flex placement, spacing).
- Expose explicit slots/children where needed instead of “stringly typed” prop bags.
- Avoid hard-coded icons/text where reuse is expected.

### 8.3 Required reusable patterns (baseline catalog)
The design system must provide reusable patterns for:
- **Headers**: `PageHeader`, `SectionHeader`, `ActionHeader`
- **Toolbars**: search + filters + primary actions
- **Empty states**: icon + message + optional action
- **Loading states**: skeletons for lists/cards/detail panes
- **Data display**: `MetricCard`, `LabeledValue`, `StatusPill`
- **Safe execution**: confirm dialogs for destructive actions; `SlideToConfirm` for critical actions (mobile-friendly)

## 9) Documentation Requirements (non-optional)
### 9.1 Component documentation format
Every primitive and pattern must have documentation containing:
- Purpose (“when to use” / “when not to use”)
- Anatomy (named parts/slots)
- Props API (variants/sizes/states)
- States (default/hover/focus/disabled/loading)
- Accessibility notes (ARIA, keyboard interaction)
- Examples (basic + real-world)

Documentation location (choose one and standardize):
- Storybook (preferred), or
- Markdown/MDX under `docs/design-system/`

### 9.2 Token documentation
Maintain a token reference page covering:
- Token hierarchy and naming rules
- What tokens are canonical vs deprecated
- How to add a token (including light/dark requirements)

## 10) Governance (prevent regression into duplication)
### 10.1 Ownership
- `client/src/components/ui/*` is owned by a designated maintainer group (design system owners).
- Suggested minimum ownership structure:
  - 1 design-system lead (dev)
  - 1 product designer partner
  - 1 rotating feature engineer
- Feature teams can contribute via a lightweight RFC process.

### 10.2 Component lifecycle
All new components follow:
Proposed → In Review (design/a11y/dev review) → Approved → Deprecated → Retired

### 10.3 Contribution rules
To add a primitive or variant:
1) Prove it does not already exist (inventory check).
2) Justify the abstraction (what duplication it replaces).
3) Implement using tokens + CVA + accessibility requirements.
4) Add documentation (and tests for primitives).
5) Provide migration notes if replacing existing behavior.

### 10.4 Standards (must meet)
- Accessibility: WCAG 2.1 AA minimum for all primitives/patterns.
- Responsive: mobile-first layouts; touch targets meet minimum sizing.
- Theming: light + dark supported for all primitives/patterns.
- Performance: changes must include a brief note on bundle impact; avoid adding large deps for small UI wins.

### 10.5 Versioning and deprecation
Treat the design system as an API:
- Token or primitive breaking changes require a migration note and a deprecation window.
- Deprecations must provide a clear replacement and a removal target date/version.
  - In-code deprecations use TypeScript JSDoc `@deprecated` where feasible.

## 11) Enforcement (automatable quality gates)
The repo must enforce, via lint rules and/or a CI script:
- No raw `<button>` in `client/src/**` except documented exceptions.
- No duplicate Button primitive implementation outside `client/src/components/ui/button.tsx`.
- No duplicated “button variant” definitions (e.g., CVA blocks that restyle buttons instead of adding to `buttonVariants`).
- No new hard-coded UI colors for semantic roles once the relevant token exists.

Minimum viable enforcement approach (acceptable):
- A fast script using `rg`/AST checks wired into `npm run check` or CI that fails on forbidden patterns.

## 12) Testing Requirements
- Each primitive must have at least one lightweight render test verifying:
  - Renders and merges `className`
  - Variant switching affects class output
- Patterns/components require tests only when logic exists (not pure markup).

## 13) Acceptance Criteria (Definition of Done)
- Standard actions across the app use `Button` (or a wrapper that composes it), with documented variants.
- No duplicate “primary button” styling logic exists outside `client/src/components/ui/button.tsx`.
- At least two large containers are decomposed into view + feature components (target: `client/src/pages/service-catalog.tsx` and `client/src/pages/operations-hub.tsx`).
- Foundations are documented (tokens, typography, spacing, elevation), and new additions follow the hierarchy.
- CI enforcement prevents new duplicates and raw button regressions.

## 14) Adoption Plan (phased)
### Phase 0: Baseline inventory
- Inventory raw `<button>` usage and bespoke action styling.
- Identify repeating patterns worth extracting (headers, filter bars, health/status display).

### Phase 1: Button consolidation
- Replace raw `<button>` usage with:
  - `Button` for standard actions
  - `Toggle`/`Tabs` for selection controls
  - `Button asChild` for links styled as buttons
- Add missing `Button` variants/sizes instead of per-screen re-styling.

### Phase 2: Container decomposition
- Extract reusable components from large pages into `features/*` and `components/patterns/*`.

### Phase 3: Enforce and prevent regressions
- Add a lint/script gate that fails when duplication rules are violated.

## 15) Container Breakdown Checklist (required for every page)
Use this checklist to ensure every route is decomposed into reusable, composable parts.

### 15.1 Rules
- A page file in `client/src/pages/*` must be a container: data/routing/state only.
- Do not define reusable components inline inside page files.
  - Exception: a tiny “local-only” helper component under ~30 lines, used only once, with no styling branching.
- Any button-like action must use `Button` (or a wrapper that composes it). Do not ship raw `<button>` for standard actions.
- Any new status/severity indicator must use standardized status tokens/palette; do not invent new inline color mappings.

### 15.2 Required outputs of decomposition
For each route/page, produce:
- `*Page` (container): fetch/query, URL params, orchestration.
- `*View` (presentational): renders layout from props; no routing and no data fetching.
- Feature components in `features/<feature>/components/*` for repeated sections.
- Shared patterns in `client/src/components/patterns/*` when used across features.

### 15.3 Suggested extraction targets (current repo)
These are examples of what “good decomposition” looks like for current pages.

- `client/src/pages/service-catalog.tsx`
  - Extract `ServiceCard` (currently inline) into `features/service-catalog/components/ServiceCard.tsx`
  - Extract health display into a reusable `StatusPill`/`HealthBadge` pattern (shared)
  - Extract filter + select controls into a `ServiceCatalogFilters` component (feature)

- `client/src/pages/operations-hub.tsx`
  - Extract any “action list”/“action detail” split into `OperationsHubView` + feature components
  - Extract repeated action buttons into a pattern-level `ActionFooter` (shared across sheets/panels)

- `client/src/pages/ops-console.tsx`
  - Extract console navigation/header actions into a reusable header/pattern component
  - Ensure “critical actions” use the safe-execution pattern (`SlideToConfirm` or confirm dialog)

- `client/src/pages/dashboard.tsx`
  - Ensure metric tiles, activity views, and “quick stats” render via pattern components (not inline markup)
