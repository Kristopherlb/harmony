# Design System Patterns

This document provides an index of all reusable patterns in the design system.

## Shared Patterns

Patterns in `client/src/components/patterns/` are reusable across features:

### StatusPill
- **File**: `components/patterns/StatusPill.tsx`
- **Purpose**: Standardized health/status indicator
- **Documentation**: [StatusPill.md](./components/StatusPill.md)
- **Usage**: Service health, workflow status

### MetricCard
- **File**: `components/patterns/MetricCard.tsx`
- **Purpose**: Reusable metric display card
- **Documentation**: [MetricCard.md](./components/MetricCard.md)
- **Usage**: DORA metrics, service metrics, dashboard stats

### PageHeader
- **File**: `components/patterns/PageHeader.tsx`
- **Purpose**: Standardized page headers with title, description, actions
- **Documentation**: [PageHeader.md](./components/PageHeader.md)
- **Usage**: All page headers

### SectionHeader
- **File**: `components/patterns/SectionHeader.tsx`
- **Purpose**: Section dividers with titles
- **Documentation**: [SectionHeader.md](./components/SectionHeader.md)
- **Usage**: Category sections, grouped content

### EmptyState
- **File**: `components/patterns/EmptyState.tsx`
- **Purpose**: Reusable empty state with icon, message, optional action
- **Documentation**: [EmptyState.md](./components/EmptyState.md)
- **Usage**: Empty lists, no results, no data states

### LabeledValue
- **File**: `components/patterns/LabeledValue.tsx`
- **Purpose**: Key-value display component
- **Documentation**: [LabeledValue.md](./components/LabeledValue.md)
- **Usage**: Detail views, metadata display

## Feature Components

Feature-specific components live in `client/src/features/<feature>/components/`:

### Service Catalog
- `ServiceCard`: Service card display
- `ServiceGraph`: Service dependency graph
- `ServiceCatalogFilters`: Filter controls

### Operations Hub
- `ActionCard`: Action card display
- `ApprovalCard`: Approval request card
- `ExecutionRow`: Execution history row

## Usage Guidelines

1. **Import from patterns**: Always import patterns from `@/components/patterns/`
2. **Compose, don't duplicate**: Build feature components from patterns
3. **Props-driven**: All patterns accept props, no implicit data loading
4. **Semantic tokens**: All patterns use semantic tokens, not hard-coded colors
