# Design System Inventory

This document catalogs the current state of design system implementation and remaining violations.

## Current State (Updated)

### ✅ Completed

**Phase 0: Baseline Inventory**
- ✅ Inventory script created (`script/inventory-design-system.ts`) - syntax error fixed
- ✅ Violations documented

**Phase 1: Foundation & Token Standardization**
- ✅ Status/health/risk tokens added to `client/src/index.css` (light + dark values)
- ✅ Tailwind config updated with status and risk token mappings (including foreground support)
- ✅ Token documentation created (`docs/design-system/tokens.md`)
- ✅ Color migration guide created (`docs/design-system/color-migration.md`)

**Phase 2: Pattern & Component Extraction**
- ✅ Directory structure created (`components/patterns/`, `features/`)
- ✅ Shared patterns extracted:
  - `StatusPill` (with tests)
  - `MetricCard` (with tests)
  - `PageHeader`
  - `SectionHeader`
  - `EmptyState` (with tests)
  - `LabeledValue`
- ✅ Service Catalog extraction:
  - `ServiceCard` extracted to `features/service-catalog/components/ServiceCard.tsx`
  - `ServiceGraph` extracted to `features/service-catalog/components/ServiceGraph.tsx`
  - `ServiceCatalogFilters` extracted
  - `ServiceCatalogView` created
  - `service-catalog.tsx` refactored to ~99 lines (container-only)
- ✅ Operations Hub extraction:
  - `ActionCard` extracted to `features/operations-hub/components/ActionCard.tsx`
  - `ApprovalCard` extracted
  - `ExecutionRow` extracted
  - `OperationsHubView` created
  - `operations-hub.tsx` refactored to use view component (RISK_COLORS removed)

**Phase 3: Color Replacement**
- ✅ Major components updated:
  - `status-indicator.tsx` - uses semantic tokens
  - `quick-stats.tsx` - uses semantic tokens
  - `security-section.tsx` - uses semantic tokens
  - `security-finding-detail.tsx` - uses semantic tokens
  - `event-detail-sheet.tsx` - uses semantic tokens
  - `signal-feed.tsx` - uses semantic tokens
  - `context-workspace.tsx` - uses semantic tokens
  - `dora-metrics-detail.tsx` - uses semantic tokens
  - `unified-stream.tsx` - uses semantic tokens
  - `activity-heatmap.tsx` - uses semantic tokens
  - `noc-header.tsx` - uses semantic tokens
  - `source-breakdown.tsx` - uses semantic tokens
  - `slide-to-confirm.tsx` - uses semantic tokens
  - `mobile-action-drawer.tsx` - RISK_COLORS replaced
  - `action-panel.tsx` - RISK_COLORS replaced
  - `user-profile-sheet.tsx` - uses semantic tokens
  - `report-panel.tsx` - uses semantic tokens
  - `slack-command-panel.tsx` - uses semantic tokens
  - `user-action-menu.tsx` - uses semantic tokens
  - `ui/toast.tsx` - uses semantic tokens
  - `pages/not-found.tsx` - uses semantic tokens
  - `dora-metrics.tsx` - uses `MetricCard` pattern

**Phase 4: Documentation**
- ✅ Component documentation created (`StatusPill.md`, `patterns.md`)
- ✅ Exceptions documentation created
- ✅ Pattern catalog with usage guidelines

**Phase 5: Enforcement**
- ✅ Enforcement script created (`script/check-design-system.ts`)
- ✅ Integrated into CI via `package.json` (`check:design-system` script)
- ✅ Script checks for raw buttons, hard-coded colors, inline components

**Phase 6: Testing**
- ✅ Tests created for `StatusPill`, `MetricCard`, `EmptyState`, `ServiceCard`
- ✅ Tests follow TDD approach

### ⚠️ Remaining Work

**Color Replacement (In Progress)**
- Some hard-coded colors may remain in less frequently used components
- Enforcement script will catch any remaining violations
- Run `npm run check:design-system` to identify remaining issues

**Operations Hub Integration**
- `operations-hub.tsx` now uses `OperationsHubView` and extracted components
- All RISK_COLORS references removed from operations-hub.tsx

## Migration Status

### Files Fully Migrated
- `client/src/pages/service-catalog.tsx` - ✅ Complete
- `client/src/pages/operations-hub.tsx` - ✅ Complete
- `client/src/components/status-indicator.tsx` - ✅ Complete
- `client/src/components/quick-stats.tsx` - ✅ Complete
- `client/src/components/security-section.tsx` - ✅ Complete
- `client/src/components/security-finding-detail.tsx` - ✅ Complete
- `client/src/components/dora-metrics.tsx` - ✅ Complete (uses MetricCard pattern)
- All extracted feature components - ✅ Complete

### Files Partially Migrated
- Some components may have remaining hard-coded colors in edge cases
- Enforcement script will identify any remaining violations

## Token Usage

All status/health/risk indicators now use semantic tokens:
- `bg-status-healthy`, `text-status-healthy` (replaces `bg-emerald-500`, `text-emerald-400`)
- `bg-status-degraded`, `text-status-degraded` (replaces `bg-amber-500`, `text-amber-400`)
- `bg-status-critical`, `text-status-critical` (replaces `bg-red-500`, `text-red-400`)
- `bg-status-unknown`, `text-status-unknown` (replaces `bg-gray-500`, `text-gray-400`)
- `bg-risk-low`, `text-risk-low` (replaces `bg-green-500`, `text-green-400`)
- `bg-risk-medium`, `text-risk-medium` (replaces `bg-yellow-500`, `text-yellow-400`)
- `bg-risk-high`, `text-risk-high` (replaces `bg-orange-500`, `text-orange-400`)
- `bg-risk-critical`, `text-risk-critical` (replaces `bg-red-500`, `text-red-400`)

## Next Steps

1. Run `npm run check:design-system` to verify all violations are resolved
2. Address any remaining hard-coded colors identified by the enforcement script
3. Continue refactoring remaining pages to use extracted components
4. Add more comprehensive tests for patterns
