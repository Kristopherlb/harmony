/**
 * packages/apps/console/server/agent/execution-monitor.ts
 * Phase 4.3.3: Chat-driven execution monitoring — fetch workflow status and cancel for agent context.
 */
import { getTemporalClient } from "../services/temporal/temporal-client.js";

export type WorkflowDescribe = {
  workflowId: string;
  runId: string;
  status: string;
  type: string;
  startTime?: string;
  closeTime?: string;
  historyLength?: number;
};

/**
 * Fetches workflow describe from Temporal and returns human-readable summary for chat.
 */
export async function getExecutionStatus(workflowId: string): Promise<string> {
  try {
    const client = await getTemporalClient();
    const handle = client.getHandle(workflowId);
    const description = await handle.describe();

    const describe: WorkflowDescribe = {
      workflowId: description.workflowId,
      runId: description.runId,
      status: description.status.name,
      type: description.type,
      startTime: description.startTime,
      closeTime: description.closeTime,
      historyLength: description.historyLength,
    };

    return formatExecutionStatusForChat(describe);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return `Failed to get workflow status: ${message}`;
  }
}

/**
 * Formats workflow describe as a short, human-readable block for the agent to use in chat.
 */
export function formatExecutionStatusForChat(describe: WorkflowDescribe): string {
  const lines: string[] = [
    `Workflow: ${describe.workflowId}`,
    `Status: ${describe.status}`,
    `Type: ${describe.type}`,
    `Run ID: ${describe.runId}`,
  ];

  if (describe.startTime) {
    lines.push(`Started: ${new Date(describe.startTime).toISOString()}`);
  }
  if (describe.closeTime) {
    lines.push(`Closed: ${new Date(describe.closeTime).toISOString()}`);
  }
  if (describe.startTime && describe.closeTime) {
    const ms =
      new Date(describe.closeTime).getTime() - new Date(describe.startTime).getTime();
    lines.push(`Duration: ${ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`}`);
  } else if (describe.startTime) {
    const ms = Date.now() - new Date(describe.startTime).getTime();
    lines.push(`Elapsed: ${ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`}`);
  }
  if (describe.historyLength != null) {
    lines.push(`History events: ${describe.historyLength}`);
  }

  return lines.join("\n");
}

/**
 * Cancels (terminates) a running workflow. Returns { ok: true } or { ok: false, error }.
 */
export async function cancelExecution(workflowId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const client = await getTemporalClient();
    const handle = client.getHandle(workflowId);
    await handle.terminate();
    return { ok: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message };
  }
}

/**
 * Heuristic: does the user message look like a request for workflow status?
 */
export function isStatusQuery(text: string): boolean {
  const lower = text.toLowerCase().trim();
  const statusPhrases = [
    "what's the status",
    "whats the status",
    "what is the status",
    "how's the run",
    "hows the run",
    "workflow status",
    "execution status",
    "is it done",
    "is it running",
    "status?",
    "status of",
  ];
  return statusPhrases.some((p) => lower.includes(p));
}

/**
 * Heuristic: does the user message look like a request to cancel the workflow?
 */
export function isCancelQuery(text: string): boolean {
  const lower = text.toLowerCase().trim();
  const cancelPhrases = [
    "cancel the workflow",
    "cancel workflow",
    "stop the workflow",
    "stop workflow",
    "terminate the workflow",
    "cancel the run",
    "stop the run",
  ];
  return cancelPhrases.some((p) => lower.includes(p));
}
