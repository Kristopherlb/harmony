/**
 * packages/apps/console/server/http/workflow-progress.ts
 * Phase 4.3.2 / IMP-045: Derive step-level progress from Temporal history events.
 *
 * NOTE: This intentionally only derives status for ExecuteCapability (executeDaggerCapability)
 * activities. The client maps those step records back onto draft node IDs.
 */

export type WorkflowStepStatus = "pending" | "running" | "completed" | "failed";

export type WorkflowStepProgress = {
  /** Monotonic sequence number (Temporal eventId for the scheduled event). */
  seq: number;
  activityId: string;
  capId: string;
  /** Workbench node id correlation (preferred when available). */
  nodeId?: string;
  status: WorkflowStepStatus;
};

export type WorkflowProgress = {
  steps: WorkflowStepProgress[];
};

type TemporalPayload = {
  metadata?: Record<string, Uint8Array>;
  data?: Uint8Array;
};

function readEncoding(payload: TemporalPayload | undefined): string {
  const enc = payload?.metadata?.encoding;
  if (!enc) return "";
  try {
    return Buffer.from(enc).toString("utf8");
  } catch {
    return "";
  }
}

function decodeJsonPayload(payload: TemporalPayload | undefined): unknown {
  if (!payload?.data) return undefined;
  const encoding = readEncoding(payload);
  if (encoding !== "json/plain") return undefined;
  try {
    return JSON.parse(Buffer.from(payload.data).toString("utf8"));
  } catch {
    return undefined;
  }
}

function capIdFromScheduledInput(input: TemporalPayload[] | undefined): string | undefined {
  const first = Array.isArray(input) ? input[0] : undefined;
  const decoded = decodeJsonPayload(first);
  if (!decoded || typeof decoded !== "object") return undefined;
  const obj = decoded as Record<string, unknown>;
  return typeof obj.capId === "string" && obj.capId.length > 0 ? obj.capId : undefined;
}

function nodeIdFromScheduledInput(input: TemporalPayload[] | undefined): string | undefined {
  const first = Array.isArray(input) ? input[0] : undefined;
  const decoded = decodeJsonPayload(first);
  if (!decoded || typeof decoded !== "object") return undefined;
  const obj = decoded as Record<string, unknown>;
  const correlation = obj.correlation;
  if (!correlation || typeof correlation !== "object") return undefined;
  const nodeId = (correlation as Record<string, unknown>).nodeId;
  return typeof nodeId === "string" && nodeId.length > 0 ? nodeId : undefined;
}

/**
 * Pure derivation: Temporal history events -> step progress list.
 *
 * We treat the scheduled eventId as the stable step sequence identifier.
 */
export function deriveWorkflowProgressFromHistory(events: Array<any>): WorkflowProgress {
  const stepsByScheduledId = new Map<number, WorkflowStepProgress>();

  for (const e of events ?? []) {
    const eventId = typeof e?.eventId === "number" ? e.eventId : undefined;
    const eventType = typeof e?.eventType === "string" ? e.eventType : "";

    if (
      eventType === "EVENT_TYPE_ACTIVITY_TASK_SCHEDULED" &&
      e?.activityTaskScheduledEventAttributes?.activityType?.name === "executeDaggerCapability" &&
      eventId != null
    ) {
      const attrs = e.activityTaskScheduledEventAttributes;
      const activityId = typeof attrs?.activityId === "string" ? attrs.activityId : `activity-${eventId}`;
      const capId = capIdFromScheduledInput(attrs?.input) ?? "unknown.capability";
      const nodeId = nodeIdFromScheduledInput(attrs?.input);

      stepsByScheduledId.set(eventId, {
        seq: eventId,
        activityId,
        capId,
        nodeId,
        status: "pending",
      });
      continue;
    }

    const scheduledEventId =
      eventType === "EVENT_TYPE_ACTIVITY_TASK_STARTED"
        ? e?.activityTaskStartedEventAttributes?.scheduledEventId
        : eventType === "EVENT_TYPE_ACTIVITY_TASK_COMPLETED"
          ? e?.activityTaskCompletedEventAttributes?.scheduledEventId
          : eventType === "EVENT_TYPE_ACTIVITY_TASK_FAILED"
            ? e?.activityTaskFailedEventAttributes?.scheduledEventId
            : eventType === "EVENT_TYPE_ACTIVITY_TASK_TIMED_OUT"
              ? e?.activityTaskTimedOutEventAttributes?.scheduledEventId
              : eventType === "EVENT_TYPE_ACTIVITY_TASK_CANCELED"
                ? e?.activityTaskCanceledEventAttributes?.scheduledEventId
                : undefined;

    if (typeof scheduledEventId !== "number") continue;
    const step = stepsByScheduledId.get(scheduledEventId);
    if (!step) continue;

    if (eventType === "EVENT_TYPE_ACTIVITY_TASK_STARTED") step.status = "running";
    if (eventType === "EVENT_TYPE_ACTIVITY_TASK_COMPLETED") step.status = "completed";
    if (
      eventType === "EVENT_TYPE_ACTIVITY_TASK_FAILED" ||
      eventType === "EVENT_TYPE_ACTIVITY_TASK_TIMED_OUT" ||
      eventType === "EVENT_TYPE_ACTIVITY_TASK_CANCELED"
    ) {
      step.status = "failed";
    }
  }

  const steps = Array.from(stepsByScheduledId.values()).sort((a, b) => a.seq - b.seq);
  return { steps };
}

