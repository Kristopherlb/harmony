import { cn } from "@/lib/utils";
import type { Severity } from "@shared/schema";

interface StatusIndicatorProps {
  severity: Severity;
  size?: "sm" | "md" | "lg";
  pulse?: boolean;
  className?: string;
}

const severityColors = {
  low: "bg-status-healthy",
  medium: "bg-status-degraded",
  high: "bg-risk-high",
  critical: "bg-status-critical",
} as const;

const severityGlows = {
  low: "glow-green",
  medium: "glow-amber",
  high: "glow-amber",
  critical: "glow-red",
} as const;

const sizeClasses = {
  sm: "h-2 w-2",
  md: "h-3 w-3",
  lg: "h-4 w-4",
} as const;

export function StatusIndicator({
  severity,
  size = "md",
  pulse = false,
  className,
}: StatusIndicatorProps) {
  return (
    <span
      className={cn(
        "inline-block rounded-full",
        severityColors[severity],
        sizeClasses[size],
        pulse && "pulse-indicator",
        severity === "critical" && severityGlows[severity],
        className
      )}
      data-testid={`status-indicator-${severity}`}
    />
  );
}

interface SystemStatusProps {
  label: string;
  status: "operational" | "degraded" | "outage";
  className?: string;
}

const statusMap = {
  operational: { severity: "low" as Severity, text: "Operational" },
  degraded: { severity: "medium" as Severity, text: "Degraded" },
  outage: { severity: "critical" as Severity, text: "Outage" },
} as const;

export function SystemStatus({ label, status, className }: SystemStatusProps) {
  const { severity, text } = statusMap[status];

  return (
    <div
      className={cn("flex items-center gap-2", className)}
      data-testid={`system-status-${label.toLowerCase().replace(/\s/g, "-")}`}
    >
      <StatusIndicator severity={severity} pulse={status === "outage"} />
      <span className="font-mono text-sm text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-mono text-sm",
          severity === "low" && "text-status-healthy",
          severity === "medium" && "text-status-degraded",
          severity === "critical" && "text-status-critical"
        )}
      >
        {text}
      </span>
    </div>
  );
}
