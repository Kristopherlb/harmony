/**
 * packages/apps/console/client/src/features/workbench/__tests__/node-explanation.test.ts
 * Unit tests for node explanation message builder (Phase 4.2.3).
 */
import { describe, expect, it } from "vitest";
import { buildExplainStepMessage } from "../node-explanation";

describe("node-explanation", () => {
  it("buildExplainStepMessage includes node label and id", () => {
    const msg = buildExplainStepMessage({
      node: { id: "n2", label: "Create Jira ticket", type: "jira.createIssue" },
    });
    expect(msg).toContain("Create Jira ticket");
    expect(msg).toContain("n2");
    expect(msg).toMatch(/Explain why you added/);
  });
});
