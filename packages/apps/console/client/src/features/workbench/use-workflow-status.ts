/**
 * packages/apps/console/client/src/features/workbench/use-workflow-status.ts
 * Phase 4.3.2: Poll workflow describe for live canvas and timeline.
 */
import { useEffect, useState } from "react";

export type WorkflowDescribe = {
  workflowId: string;
  runId: string;
  status: string;
  type: string;
  startTime?: string;
  closeTime?: string;
  historyLength?: number;
};

const POLL_MS = 1000;
const TERMINAL_STATUSES = ["COMPLETED", "FAILED", "CANCELED", "TERMINATED"];

/**
 * Polls GET /api/workflows/:id and returns describe; stops when status is terminal.
 */
export function useWorkflowStatus(workflowId: string | null): WorkflowDescribe | null {
  const [describe, setDescribe] = useState<WorkflowDescribe | null>(null);

  useEffect(() => {
    if (!workflowId) {
      setDescribe(null);
      return;
    }

    let cancelled = false;

    const fetchStatus = async () => {
      try {
        const res = await fetch(
          `/api/workflows/${encodeURIComponent(workflowId)}`,
          { credentials: "include" }
        );
        if (!res.ok) return;
        const json = (await res.json()) as WorkflowDescribe;
        if (!cancelled) setDescribe(json);
      } catch {
        // ignore
      }
    };

    void fetchStatus();
    const interval = setInterval(() => {
      void fetchStatus();
    }, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [workflowId]);

  return describe;
}

/**
 * Returns true when workflow status is terminal (no need to keep polling for UI).
 */
export function isTerminalStatus(status: string): boolean {
  return TERMINAL_STATUSES.includes(status);
}
