import * as React from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus, ChevronRight } from "lucide-react";

export interface MetricCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  value: string | number;
  unit: string;
  icon: React.ReactNode;
  trend?: "up" | "down" | "stable";
  trendValue?: string;
  status: "good" | "medium" | "poor";
  isLoading?: boolean;
  onClick?: () => void;
}

// Map status to semantic tokens
const statusColorClasses = {
  good: "text-status-healthy",
  medium: "text-status-degraded",
  poor: "text-status-critical",
} as const;

const statusGlowClasses = {
  good: "glow-green",
  medium: "glow-amber",
  poor: "glow-red",
} as const;

const MetricCard = React.forwardRef<HTMLDivElement, MetricCardProps>(
  (
    {
      className,
      title,
      value,
      unit,
      icon,
      trend,
      trendValue,
      status,
      isLoading,
      onClick,
      ...props
    },
    ref
  ) => {
    const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
    const trendColor =
      trend === "up"
        ? "text-status-healthy"
        : trend === "down"
          ? "text-status-critical"
          : "text-muted-foreground";

    return (
      <Card
        ref={ref}
        className={cn(
          "p-3 sm:p-4 font-mono border border-border bg-card transition-all cursor-pointer hover-elevate group min-h-[100px] touch-manipulation",
          status === "poor" ? statusGlowClasses[status] : "",
          className
        )}
        data-testid={`metric-card-${title.toLowerCase().replace(/\s/g, "-")}`}
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick?.();
          }
        }}
        {...props}
      >
        {isLoading ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-4 bg-muted rounded w-24" />
            <div className="h-8 bg-muted rounded w-16" />
            <div className="h-3 bg-muted rounded w-20" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className={statusColorClasses[status]}>{icon}</div>
                <span className="text-xs uppercase tracking-wider">{title}</span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>

            <div className="flex items-baseline gap-2">
              <span className={cn("text-2xl font-bold", statusColorClasses[status])}>
                {value}
              </span>
              <span className="text-sm text-muted-foreground">{unit}</span>
            </div>

            {trend && trendValue && (
              <div className={cn("flex items-center gap-1 mt-2 text-xs", trendColor)}>
                <TrendIcon className="h-3 w-3" />
                <span>{trendValue}</span>
              </div>
            )}
          </>
        )}
      </Card>
    );
  }
);

MetricCard.displayName = "MetricCard";

export { MetricCard };
