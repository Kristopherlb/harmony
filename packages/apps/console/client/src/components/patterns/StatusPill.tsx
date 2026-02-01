import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import type { ServiceHealth, WorkflowStatus } from "@shared/schema";

const statusPillVariants = cva(
  "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium capitalize",
  {
    variants: {
      status: {
        // ServiceHealth variants
        healthy: "bg-status-healthy text-status-healthy-foreground",
        degraded: "bg-status-degraded text-status-degraded-foreground",
        critical: "bg-status-critical text-status-critical-foreground",
        unknown: "bg-status-unknown text-status-unknown-foreground",
        // WorkflowStatus variants
        pending: "bg-muted text-muted-foreground",
        pending_approval: "bg-status-degraded text-status-degraded-foreground",
        approved: "bg-status-healthy text-status-healthy-foreground",
        rejected: "bg-status-critical text-status-critical-foreground",
        running: "bg-primary text-primary-foreground",
        completed: "bg-status-healthy text-status-healthy-foreground",
        failed: "bg-status-critical text-status-critical-foreground",
        cancelled: "bg-muted text-muted-foreground",
      },
    },
    defaultVariants: {
      status: "unknown",
    },
  }
);

export interface StatusPillProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusPillVariants> {
  status: ServiceHealth | WorkflowStatus;
  showDot?: boolean;
  label?: string;
}

const StatusPill = React.forwardRef<HTMLSpanElement, StatusPillProps>(
  ({ className, status, showDot = false, label, ...props }, ref) => {
    const displayText = label || status.replace("_", " ");

    // Map status to dot color class
    const getDotColorClass = (status: ServiceHealth | WorkflowStatus): string => {
      if (status === "healthy" || status === "completed" || status === "approved") {
        return "bg-status-healthy";
      }
      if (status === "degraded" || status === "pending_approval") {
        return "bg-status-degraded";
      }
      if (status === "critical" || status === "failed" || status === "rejected") {
        return "bg-status-critical";
      }
      if (status === "running") {
        return "bg-primary";
      }
      return "bg-status-unknown";
    };

    return (
      <span
        ref={ref}
        className={cn(statusPillVariants({ status, className }))}
        role="status"
        aria-label={`Status: ${displayText}`}
        {...props}
      >
        {showDot && (
          <span
            className={cn("h-2 w-2 rounded-full", getDotColorClass(status))}
            aria-hidden="true"
          />
        )}
        {displayText}
      </span>
    );
  }
);

StatusPill.displayName = "StatusPill";

export { StatusPill, statusPillVariants };
