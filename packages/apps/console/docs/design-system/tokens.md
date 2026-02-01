# Design System Tokens

## Token Hierarchy

The design system follows a 3-layer token hierarchy:

1. **Primitive Tokens** (Layer 1): Raw design values
   - Palette values (HSL color values)
   - Spacing steps (4px base unit)
   - Radii steps
   - Typography scales

2. **Semantic Tokens** (Layer 2): Meaning-based tokens
   - `--surface-*`, `--text-*`, `--border-*` roles
   - `--status-*` for health/status indicators
   - `--risk-*` for action risk levels
   - Purpose-based, not page/feature-specific

3. **Component Tokens** (Layer 3): Component-specific tokens
   - `--button-*`, `--card-*` only when necessary
   - Should be avoided unless component-specific needs exist

## Token Naming Conventions

- CSS variables use kebab-case: `--surface-1`, `--text-primary`, `--border-default`
- Token names must be semantic (purpose-based), not page/feature-specific
- Every token must define both light + dark values
- Foreground tokens use `-foreground` suffix (e.g., `--status-healthy-foreground`)

## Complete Token Reference

### Surface Tokens

| Token | Light Mode | Dark Mode | Usage |
|-------|-----------|----------|-------|
| `--background` | `210 20% 98%` | `222 47% 6%` | Main background |
| `--foreground` | `222 47% 11%` | `210 20% 92%` | Main text color |
| `--card` | `0 0% 100%` | `222 47% 9%` | Card backgrounds |
| `--card-foreground` | `222 47% 11%` | `210 20% 92%` | Card text |
| `--card-border` | `214 20% 90%` | `217 19% 16%` | Card borders |
| `--muted` | `215 20% 94%` | `217 19% 14%` | Muted backgrounds |
| `--muted-foreground` | `215 16% 47%` | `215 20% 55%` | Muted text |
| `--accent` | `215 20% 92%` | `217 19% 16%` | Accent backgrounds |
| `--accent-foreground` | `222 47% 11%` | `210 20% 92%` | Accent text |

### Interactive Tokens

| Token | Light Mode | Dark Mode | Usage |
|-------|-----------|----------|-------|
| `--primary` | `217 91% 60%` | `217 91% 60%` | Primary actions |
| `--primary-foreground` | `0 0% 100%` | `0 0% 100%` | Primary text |
| `--secondary` | `215 20% 94%` | `217 19% 14%` | Secondary actions |
| `--secondary-foreground` | `222 47% 11%` | `210 20% 92%` | Secondary text |
| `--destructive` | `0 84% 60%` | `0 72% 51%` | Destructive actions |
| `--destructive-foreground` | `0 0% 100%` | `0 0% 100%` | Destructive text |
| `--ring` | `217 91% 60%` | `217 91% 60%` | Focus rings |

### Status/Health Tokens

| Token | Light Mode | Dark Mode | Usage |
|-------|-----------|----------|-------|
| `--status-healthy` | `142 71% 45%` | `142 71% 50%` | Healthy service state |
| `--status-healthy-foreground` | `0 0% 100%` | `0 0% 100%` | Text on healthy |
| `--status-degraded` | `38 92% 50%` | `38 92% 55%` | Degraded service state |
| `--status-degraded-foreground` | `0 0% 100%` | `0 0% 100%` | Text on degraded |
| `--status-critical` | `0 84% 60%` | `0 72% 51%` | Critical service state |
| `--status-critical-foreground` | `0 0% 100%` | `0 0% 100%` | Text on critical |
| `--status-unknown` | `215 16% 47%` | `215 20% 55%` | Unknown service state |
| `--status-unknown-foreground` | `0 0% 100%` | `0 0% 100%` | Text on unknown |

### Risk Level Tokens

| Token | Light Mode | Dark Mode | Usage |
|-------|-----------|----------|-------|
| `--risk-low` | `142 71% 45%` | `142 71% 50%` | Low risk actions |
| `--risk-low-foreground` | `0 0% 100%` | `0 0% 100%` | Text on low risk |
| `--risk-medium` | `38 92% 50%` | `38 92% 55%` | Medium risk actions |
| `--risk-medium-foreground` | `0 0% 100%` | `0 0% 100%` | Text on medium risk |
| `--risk-high` | `25 95% 53%` | `25 95% 58%` | High risk actions |
| `--risk-high-foreground` | `0 0% 100%` | `0 0% 100%` | Text on high risk |
| `--risk-critical` | `0 84% 60%` | `0 72% 51%` | Critical risk actions |
| `--risk-critical-foreground` | `0 0% 100%` | `0 0% 100%` | Text on critical risk |

### User Presence Status (Legacy)

| Token | Value | Usage |
|-------|-------|-------|
| `status.online` | `rgb(34 197 94)` | User online |
| `status.away` | `rgb(245 158 11)` | User away |
| `status.busy` | `rgb(239 68 68)` | User busy |
| `status.offline` | `rgb(156 163 175)` | User offline |

**Note**: These are legacy tokens. New code should use semantic tokens where possible.

## Usage Guidelines

### In Tailwind Classes

Use semantic classes that map to tokens:

```tsx
// ✅ Correct - uses semantic tokens
<div className="bg-status-healthy text-status-healthy-foreground">
<div className="bg-risk-critical text-risk-critical-foreground">
<div className="bg-card text-card-foreground border-card-border">

// ❌ Incorrect - hard-coded colors
<div className="bg-emerald-500 text-white">
<div className="bg-red-500 text-white">
```

### In CSS

Use CSS variables directly:

```css
.custom-component {
  background-color: hsl(var(--status-healthy));
  color: hsl(var(--status-healthy-foreground));
}
```

### In Component Logic

Use token-based classes, not hard-coded color objects:

```tsx
// ✅ Correct
const statusClasses = {
  healthy: "bg-status-healthy text-status-healthy-foreground",
  degraded: "bg-status-degraded text-status-degraded-foreground",
  critical: "bg-status-critical text-status-critical-foreground",
};

// ❌ Incorrect
const statusColors = {
  healthy: "bg-emerald-500",
  degraded: "bg-amber-500",
  critical: "bg-red-500",
};
```

## Migration Guide

### Step 1: Replace Hard-coded Color Objects

**Before:**
```tsx
const healthColors: Record<ServiceHealth, string> = {
  healthy: "bg-emerald-500",
  degraded: "bg-amber-500",
  critical: "bg-red-500",
  unknown: "bg-gray-500",
};
```

**After:**
```tsx
const healthClasses: Record<ServiceHealth, string> = {
  healthy: "bg-status-healthy text-status-healthy-foreground",
  degraded: "bg-status-degraded text-status-degraded-foreground",
  critical: "bg-status-critical text-status-critical-foreground",
  unknown: "bg-status-unknown text-status-unknown-foreground",
};
```

### Step 2: Replace Inline Color Utilities

**Before:**
```tsx
<span className="bg-emerald-500 text-white">Healthy</span>
```

**After:**
```tsx
<span className="bg-status-healthy text-status-healthy-foreground">Healthy</span>
```

### Step 3: Update Risk Level Colors

**Before:**
```tsx
const RISK_COLORS = {
  low: "bg-green-500/20 text-green-400 border-green-500/30",
  medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  high: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  critical: "bg-red-500/20 text-red-400 border-red-500/30",
};
```

**After:**
```tsx
const riskClasses = {
  low: "bg-risk-low/20 text-risk-low border-risk-low/30",
  medium: "bg-risk-medium/20 text-risk-medium border-risk-medium/30",
  high: "bg-risk-high/20 text-risk-high border-risk-high/30",
  critical: "bg-risk-critical/20 text-risk-critical border-risk-critical/30",
};
```

## Color Mapping Reference

### Status/Health Colors

| Old (Hard-coded) | New (Semantic Token) |
|-----------------|---------------------|
| `bg-emerald-500` | `bg-status-healthy` |
| `text-emerald-400` | `text-status-healthy` |
| `bg-amber-500` | `bg-status-degraded` |
| `text-amber-400` | `text-status-degraded` |
| `bg-red-500` | `bg-status-critical` |
| `text-red-400` | `text-status-critical` |
| `bg-gray-500` | `bg-status-unknown` |
| `text-gray-400` | `text-status-unknown` |

### Risk Level Colors

| Old (Hard-coded) | New (Semantic Token) |
|-----------------|---------------------|
| `bg-green-500/20 text-green-400` | `bg-risk-low/20 text-risk-low` |
| `bg-yellow-500/20 text-yellow-400` | `bg-risk-medium/20 text-risk-medium` |
| `bg-orange-500/20 text-orange-400` | `bg-risk-high/20 text-risk-high` |
| `bg-red-500/20 text-red-400` | `bg-risk-critical/20 text-risk-critical` |

## Adding New Tokens

When adding a new token:

1. **Determine the layer**: Is it primitive, semantic, or component?
2. **Choose a semantic name**: Purpose-based, not page/feature-specific
3. **Define both light and dark values**: In `:root` and `.dark` selectors
4. **Map to Tailwind**: Add to `tailwind.config.ts` if needed
5. **Document**: Add to this reference
6. **Update migration guide**: If replacing existing patterns

### Example: Adding a New Status Token

```css
/* In client/src/index.css */

:root {
  --status-warning: 38 92% 50%;
  --status-warning-foreground: 0 0% 100%;
}

.dark {
  --status-warning: 38 92% 55%;
  --status-warning-foreground: 0 0% 100%;
}
```

```ts
// In tailwind.config.ts
status: {
  // ... existing tokens
  warning: "hsl(var(--status-warning) / <alpha-value>)",
}
```

## Deprecated Tokens

No tokens are currently deprecated. When deprecating:

1. Add `@deprecated` JSDoc comment
2. Document replacement token
3. Set removal target date/version
4. Update migration guide
