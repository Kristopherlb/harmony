# StatusPill Component

## Purpose

StatusPill is a standardized component for displaying service health status and workflow status indicators. It replaces inline status displays and ensures consistent styling across the application.

## When to Use

- Displaying service health (healthy, degraded, critical, unknown)
- Displaying workflow execution status
- Any status indicator that needs consistent styling

## When Not to Use

- For user presence status (use existing `status.online/away/busy/offline` tokens)
- For simple text-only status displays that don't need a pill/badge style

## Anatomy

- **Container**: Pill-shaped badge with background and text color
- **Dot indicator** (optional): Small circular dot showing status color
- **Label**: Status text (capitalized)

## Props API

```tsx
interface StatusPillProps {
  status: ServiceHealth | WorkflowStatus;
  showDot?: boolean;
  label?: string;
  className?: string;
}
```

### Variants

- `status`: Required. One of:
  - ServiceHealth: `"healthy" | "degraded" | "critical" | "unknown"`
  - WorkflowStatus: `"pending" | "pending_approval" | "approved" | "rejected" | "running" | "completed" | "failed" | "cancelled"`

### Props

- `showDot`: Optional boolean. Shows a colored dot indicator before the text.
- `label`: Optional string. Custom label text. Defaults to status value.
- `className`: Optional string. Additional CSS classes.

## States

- **Default**: Normal display with semantic color
- **Hover**: Inherits from Badge component
- **Focus**: Inherits from Badge component

## Accessibility

- Uses `role="status"` for screen readers
- Includes `aria-label` with status information
- Dot indicator uses `aria-hidden="true"` as it's decorative

## Examples

### Basic Usage

```tsx
<StatusPill status="healthy" />
<StatusPill status="critical" />
<StatusPill status="degraded" />
```

### With Dot Indicator

```tsx
<StatusPill status="healthy" showDot />
```

### Custom Label

```tsx
<StatusPill status="healthy" label="All Systems Operational" />
```

### Workflow Status

```tsx
<StatusPill status="completed" />
<StatusPill status="running" />
<StatusPill status="failed" />
```
