import { describe, expect, it } from "vitest";
import { appendApprovalLog } from "./approval-log";

describe("approval-log validation", () => {
  it("rejects entries with empty approvedToolIds", async () => {
    await expect(
      appendApprovalLog({
        approverId: "user-1",
        approvedToolIds: [],
        context: { workflowId: "wf-1" },
      })
    ).rejects.toMatchObject({ code: "APPROVED_TOOL_IDS_REQUIRED" });
  });

  it("rejects entries without actionable context", async () => {
    await expect(
      appendApprovalLog({
        approverId: "user-1",
        approvedToolIds: ["tool.restricted"],
        context: { contextType: "draft" },
      })
    ).rejects.toMatchObject({ code: "APPROVAL_CONTEXT_REQUIRED" });
  });

  it("accepts entries with at least one required context field", async () => {
    const entry = await appendApprovalLog({
      approverId: "user-1",
      approvedToolIds: ["tool.restricted"],
      context: { incidentId: "incident-1", contextType: "incident" },
    });

    expect(entry.approverId).toBe("user-1");
    expect(entry.approvedToolIds).toEqual(["tool.restricted"]);
    expect(entry.context).toMatchObject({ incidentId: "incident-1", contextType: "incident" });
  });
});
