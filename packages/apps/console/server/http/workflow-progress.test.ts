import { describe, it, expect } from "vitest";
import { deriveWorkflowProgressFromHistory } from "./workflow-progress";

function jsonPayload(value: unknown) {
  const data = Buffer.from(JSON.stringify(value), "utf8");
  return {
    metadata: {
      encoding: Buffer.from("json/plain", "utf8"),
    },
    data,
  };
}

describe("deriveWorkflowProgressFromHistory", () => {
  it("produces a step record for each executeDaggerCapability activity", () => {
    const events = [
      {
        eventId: 10,
        eventType: "EVENT_TYPE_ACTIVITY_TASK_SCHEDULED",
        activityTaskScheduledEventAttributes: {
          activityId: "a1",
          activityType: { name: "executeDaggerCapability" },
          input: [jsonPayload({ capId: "cap.one", input: { x: 1 }, correlation: { nodeId: "node-1" } })],
        },
      },
    ];

    const out = deriveWorkflowProgressFromHistory(events as any);
    expect(out.steps).toEqual([
      {
        seq: 10,
        activityId: "a1",
        capId: "cap.one",
        nodeId: "node-1",
        status: "pending",
      },
    ]);
  });

  it("marks started/completed/failed based on Temporal events", () => {
    const events = [
      {
        eventId: 10,
        eventType: "EVENT_TYPE_ACTIVITY_TASK_SCHEDULED",
        activityTaskScheduledEventAttributes: {
          activityId: "a1",
          activityType: { name: "executeDaggerCapability" },
          input: [jsonPayload({ capId: "cap.one", input: {}, correlation: { nodeId: "node-1" } })],
        },
      },
      {
        eventId: 11,
        eventType: "EVENT_TYPE_ACTIVITY_TASK_STARTED",
        activityTaskStartedEventAttributes: {
          scheduledEventId: 10,
        },
      },
      {
        eventId: 12,
        eventType: "EVENT_TYPE_ACTIVITY_TASK_COMPLETED",
        activityTaskCompletedEventAttributes: {
          scheduledEventId: 10,
        },
      },
      {
        eventId: 20,
        eventType: "EVENT_TYPE_ACTIVITY_TASK_SCHEDULED",
        activityTaskScheduledEventAttributes: {
          activityId: "a2",
          activityType: { name: "executeDaggerCapability" },
          input: [jsonPayload({ capId: "cap.two", input: {}, correlation: { nodeId: "node-2" } })],
        },
      },
      {
        eventId: 21,
        eventType: "EVENT_TYPE_ACTIVITY_TASK_FAILED",
        activityTaskFailedEventAttributes: {
          scheduledEventId: 20,
        },
      },
    ];

    const out = deriveWorkflowProgressFromHistory(events as any);
    expect(out.steps).toEqual([
      { seq: 10, activityId: "a1", capId: "cap.one", nodeId: "node-1", status: "completed" },
      { seq: 20, activityId: "a2", capId: "cap.two", nodeId: "node-2", status: "failed" },
    ]);
  });

  it("ignores non-capability activities", () => {
    const events = [
      {
        eventId: 1,
        eventType: "EVENT_TYPE_ACTIVITY_TASK_SCHEDULED",
        activityTaskScheduledEventAttributes: {
          activityId: "flag-1",
          activityType: { name: "evaluateFlag" },
          input: [jsonPayload({ flagKey: "x", defaultValue: true })],
        },
      },
    ];

    const out = deriveWorkflowProgressFromHistory(events as any);
    expect(out.steps).toEqual([]);
  });
});

