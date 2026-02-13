/**
 * packages/apps/console/client/src/features/workbench/execution-timeline.tsx
 * Phase 4.3.1: Timeline view for workflow execution state (Temporal-like).
 * Polls GET /api/workflows/:id for real-time updates.
 */
import React, { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Clock, Loader2 } from "lucide-react";

export type WorkflowDescribe = {
  workflowId: string;
  runId: string;
  status: string;
  type: string;
  startTime?: string;
  closeTime?: string;
  historyLength?: number;
};

const POLL_INTERVAL_MS = 1000;

export interface ExecutionTimelineProps {
  /** When set, polls GET /api/workflows/:id and shows timeline. */
  workflowId: string | null;
  pollIntervalMs?: number;
  className?: string;
  /** Compact layout (e.g. for toolbar). */
  compact?: boolean;
}

/**
 * Execution Timeline Component
 * Shows workflow execution state: status, start/close time, duration, history length.
 * Updates via polling while workflow is running or until a terminal state.
 */
export function ExecutionTimeline({
  workflowId,
  pollIntervalMs = POLL_INTERVAL_MS,
  className,
  compact = false,
}: ExecutionTimelineProps) {
  const [describe, setDescribe] = useState<WorkflowDescribe | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workflowId) {
      setDescribe(null);
      setError(null);
      return;
    }

    let cancelled = false;

    const fetchOnce = async () => {
      try {
        const res = await fetch(
          `/api/workflows/${encodeURIComponent(workflowId)}`,
          { credentials: "include" }
        );
        if (!res.ok) {
          if (!cancelled) setError("Failed to load workflow status");
          return;
        }
        const json = (await res.json()) as WorkflowDescribe;
        if (!cancelled) {
          setDescribe(json);
          setError(null);
        }
      } catch {
        if (!cancelled) setError("Network error");
      }
    };

    void fetchOnce();
    const interval = setInterval(() => {
      void fetchOnce();
    }, pollIntervalMs);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [workflowId, pollIntervalMs]);

  if (!workflowId) return null;

  if (error) {
    return (
      <div
        className={cn("rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive", className)}
        data-testid="execution-timeline-error"
      >
        {error}
      </div>
    );
  }

  if (!describe) {
    return (
      <div
        className={cn("flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground", className)}
        data-testid="execution-timeline-loading"
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading…
      </div>
    );
  }

  const terminal = ["COMPLETED", "FAILED", "CANCELED", "TERMINATED"].includes(
    describe.status
  );
  const durationMs =
    describe.startTime && describe.closeTime
      ? new Date(describe.closeTime).getTime() - new Date(describe.startTime).getTime()
      : describe.startTime
        ? Date.now() - new Date(describe.startTime).getTime()
        : null;

  const statusVariant =
    describe.status === "COMPLETED"
      ? "default"
      : describe.status === "FAILED" || describe.status === "CANCELED" || describe.status === "TERMINATED"
        ? "destructive"
        : "secondary";

  if (compact) {
    return (
      <div
        className={cn("flex items-center gap-2 rounded-md border bg-card px-2 py-1.5 text-xs", className)}
        data-testid="execution-timeline"
      >
        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-mono truncate max-w-[120px]" title={describe.workflowId}>
          {describe.workflowId}
        </span>
        <Badge variant={statusVariant} className="text-[10px]">
          {describe.status}
        </Badge>
        {durationMs != null && (
          <span className="text-muted-foreground">
            {durationMs < 1000 ? `${durationMs}ms` : `${(durationMs / 1000).toFixed(1)}s`}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn("rounded-md border bg-card p-3 space-y-2", className)}
      data-testid="execution-timeline"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Execution
        </span>
        <Badge variant={statusVariant}>{describe.status}</Badge>
      </div>
      <div className="font-mono text-xs truncate text-muted-foreground" title={describe.workflowId}>
        {describe.workflowId}
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        {describe.startTime ? (
          <div>
            <span className="font-medium">Start</span>{" "}
            {new Date(describe.startTime).toLocaleTimeString()}
          </div>
        ) : null}
        {describe.closeTime ? (
          <div>
            <span className="font-medium">End</span>{" "}
            {new Date(describe.closeTime).toLocaleTimeString()}
          </div>
        ) : null}
        {durationMs != null && (
          <div>
            <span className="font-medium">Duration</span>{" "}
            {durationMs < 1000 ? `${durationMs}ms` : `${(durationMs / 1000).toFixed(1)}s`}
          </div>
        )}
        {describe.historyLength != null && (
          <div>
            <span className="font-medium">History</span> {describe.historyLength} events
          </div>
        )}
      </div>
      {!terminal && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Polling for updates…
        </div>
      )}
    </div>
  );
}
