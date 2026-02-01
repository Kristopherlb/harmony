# Color Migration Guide

This guide provides a quick reference for migrating hard-coded colors to semantic tokens.

## Quick Reference

### Status/Health Colors

| Old | New |
|-----|-----|
| `bg-emerald-500` | `bg-status-healthy` |
| `text-emerald-400` | `text-status-healthy` |
| `bg-amber-500` | `bg-status-degraded` |
| `text-amber-400` | `text-status-degraded` |
| `bg-red-500` | `bg-status-critical` |
| `text-red-400` | `text-status-critical` |
| `bg-gray-500` | `bg-status-unknown` |
| `text-gray-400` | `text-status-unknown` |

### Risk Level Colors

| Old | New |
|-----|-----|
| `bg-green-500/20 text-green-400 border-green-500/30` | `bg-risk-low/20 text-risk-low border-risk-low/30` |
| `bg-yellow-500/20 text-yellow-400 border-yellow-500/30` | `bg-risk-medium/20 text-risk-medium border-risk-medium/30` |
| `bg-orange-500/20 text-orange-400 border-orange-500/30` | `bg-risk-high/20 text-risk-high border-risk-high/30` |
| `bg-red-500/20 text-red-400 border-red-500/30` | `bg-risk-critical/20 text-risk-critical border-risk-critical/30` |

## Common Patterns

### Pattern 1: Color Object Replacement

**Before:**
```tsx
const healthColors: Record<ServiceHealth, string> = {
  healthy: "bg-emerald-500",
  degraded: "bg-amber-500",
  critical: "bg-red-500",
  unknown: "bg-gray-500",
};

<span className={healthColors[service.health]} />
```

**After:**
```tsx
const healthClasses: Record<ServiceHealth, string> = {
  healthy: "bg-status-healthy text-status-healthy-foreground",
  degraded: "bg-status-degraded text-status-degraded-foreground",
  critical: "bg-status-critical text-status-critical-foreground",
  unknown: "bg-status-unknown text-status-unknown-foreground",
};

<span className={healthClasses[service.health]} />
```

### Pattern 2: Inline Color Replacement

**Before:**
```tsx
<div className="bg-emerald-500 text-white rounded-full h-2.5 w-2.5" />
```

**After:**
```tsx
<div className="bg-status-healthy text-status-healthy-foreground rounded-full h-2.5 w-2.5" />
```

### Pattern 3: Conditional Color Classes

**Before:**
```tsx
<span className={service.errorRate > 1 ? "text-red-500" : "text-foreground"}>
  {service.errorRate.toFixed(2)}%
</span>
```

**After:**
```tsx
<span className={service.errorRate > 1 ? "text-status-critical" : "text-foreground"}>
  {service.errorRate.toFixed(2)}%
</span>
```

### Pattern 4: Risk Level Badges

**Before:**
```tsx
const RISK_COLORS: Record<string, string> = {
  low: "bg-green-500/20 text-green-400 border-green-500/30",
  medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  high: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  critical: "bg-red-500/20 text-red-400 border-red-500/30",
};

<Badge className={RISK_COLORS[action.riskLevel]}>
  {action.riskLevel}
</Badge>
```

**After:**
```tsx
const riskClasses: Record<string, string> = {
  low: "bg-risk-low/20 text-risk-low border-risk-low/30",
  medium: "bg-risk-medium/20 text-risk-medium border-risk-medium/30",
  high: "bg-risk-high/20 text-risk-high border-risk-high/30",
  critical: "bg-risk-critical/20 text-risk-critical border-risk-critical/30",
};

<Badge className={riskClasses[action.riskLevel]}>
  {action.riskLevel}
</Badge>
```

### Pattern 5: Function-Based Color Selection

**Before:**
```tsx
const getNodeColor = (health: ServiceHealth) => {
  switch (health) {
    case "healthy": return "#10b981";
    case "degraded": return "#f59e0b";
    case "critical": return "#ef4444";
    default: return "#6b7280";
  }
};
```

**After:**
```tsx
// Use CSS variables in style attribute
const getNodeColor = (health: ServiceHealth) => {
  const colorMap = {
    healthy: "hsl(var(--status-healthy))",
    degraded: "hsl(var(--status-degraded))",
    critical: "hsl(var(--status-critical))",
    unknown: "hsl(var(--status-unknown))",
  };
  return colorMap[health] || colorMap.unknown;
};

// Or use Tailwind classes
const getNodeColorClass = (health: ServiceHealth) => {
  const classMap = {
    healthy: "text-status-healthy",
    degraded: "text-status-degraded",
    critical: "text-status-critical",
    unknown: "text-status-unknown",
  };
  return classMap[health] || classMap.unknown;
};
```

## Files Requiring Migration

### High Priority
1. `client/src/pages/service-catalog.tsx` - 10+ instances
2. `client/src/pages/operations-hub.tsx` - 6+ instances
3. `client/src/components/dora-metrics.tsx` - 5+ instances

### Medium Priority
- All other component files (19 files total)

## Migration Checklist

- [ ] Replace all `healthColors` objects with semantic token classes
- [ ] Replace all `RISK_COLORS` objects with semantic token classes
- [ ] Replace inline `bg-emerald-500`, `bg-amber-500`, `bg-red-500` with status tokens
- [ ] Replace inline `text-emerald-400`, `text-amber-400`, `text-red-400` with status tokens
- [ ] Update function-based color selection to use tokens
- [ ] Test in both light and dark modes
- [ ] Verify accessibility contrast ratios
- [ ] Run enforcement script to verify no regressions
