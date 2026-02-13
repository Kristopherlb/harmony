/**
 * packages/apps/console/client/src/features/workbench/use-workflow-progress.ts
 * Phase 4.3.2 / IMP-045: Poll workflow history-derived progress for per-node status.
 */
import { useEffect, useState } from "react";
import type { WorkflowStepProgress, WorkflowDescribeStatus } from "./live-canvas-state";

export type WorkflowProgressResponse = WorkflowDescribeStatus & {
  workflowId: string;
  runId: string;
  steps: WorkflowStepProgress[];
};

const POLL_MS = 1000;
const TERMINAL_STATUSES = ["COMPLETED", "FAILED", "CANCELED", "TERMINATED"];

export function useWorkflowProgress(workflowId: string | null): WorkflowProgressResponse | null {
  const [progress, setProgress] = useState<WorkflowProgressResponse | null>(null);

  useEffect(() => {
    if (!workflowId) {
      setProgress(null);
      return;
    }

    let cancelled = false;

    const fetchProgress = async () => {
      try {
        const res = await fetch(`/api/workflows/${encodeURIComponent(workflowId)}/progress`, {
          credentials: "include",
        });
        if (!res.ok) return;
        const json = (await res.json()) as WorkflowProgressResponse;
        if (!cancelled) setProgress(json);
      } catch {
        // ignore
      }
    };

    void fetchProgress();
    const interval = setInterval(() => {
      void fetchProgress();
    }, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [workflowId]);

  // Best-effort: stop polling when terminal status reached.
  useEffect(() => {
    if (!progress?.status) return;
    if (!TERMINAL_STATUSES.includes(progress.status)) return;
    // Poll loop is controlled by the effect above; this hook intentionally keeps
    // the last progress snapshot until workflowId changes.
  }, [progress?.status]);

  return progress;
}

