import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle, XCircle, Loader2 } from "lucide-react";
import type { WorkflowStatus } from "@shared/schema";

const STATUS_ICONS: Record<WorkflowStatus, React.ComponentType<{ className?: string }>> = {
  pending: Clock,
  pending_approval: Clock,
  approved: CheckCircle,
  rejected: XCircle,
  running: Loader2,
  completed: CheckCircle,
  failed: XCircle,
  cancelled: XCircle,
};

const statusColorClasses: Record<WorkflowStatus, string> = {
  pending: "text-muted-foreground",
  pending_approval: "text-status-degraded",
  approved: "text-status-healthy",
  rejected: "text-status-critical",
  running: "text-primary animate-spin",
  completed: "text-status-healthy",
  failed: "text-status-critical",
  cancelled: "text-muted-foreground",
};

export interface ExecutionRowProps {
  id: string;
  actionName: string;
  executedByUsername: string;
  startedAt: string;
  status: WorkflowStatus;
}

export function ExecutionRow({
  id,
  actionName,
  executedByUsername,
  startedAt,
  status,
}: ExecutionRowProps) {
  const StatusIcon = STATUS_ICONS[status] || Clock;
  const statusColor = statusColorClasses[status] || "text-muted-foreground";

  return (
    <div
      className="flex items-center justify-between gap-4 p-3 rounded-lg border border-border"
      data-testid={`row-execution-${id}`}
    >
      <div className="flex items-center gap-3">
        <StatusIcon className={`h-4 w-4 ${statusColor}`} />
        <div>
          <div className="font-medium">{actionName}</div>
          <div className="text-xs text-muted-foreground">
            by {executedByUsername} - {new Date(startedAt).toLocaleString()}
          </div>
        </div>
      </div>
      <Badge variant="outline">{status}</Badge>
    </div>
  );
}
