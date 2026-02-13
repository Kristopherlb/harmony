/**
 * packages/apps/console/server/workbench/approval-policy.test.ts
 */
import { describe, it, expect, vi } from "vitest";
import { classifyWorkbenchToolApprovalTier } from "./approval-policy";

describe("classifyWorkbenchToolApprovalTier", () => {
  it("returns standard for non-RESTRICTED tools", () => {
    expect(
      classifyWorkbenchToolApprovalTier({ toolId: "golden.echo", dataClassification: "INTERNAL" })
    ).toBe("standard");
  });

  it("returns restricted for RESTRICTED tools by default", () => {
    expect(
      classifyWorkbenchToolApprovalTier({ toolId: "golden.some.restricted", dataClassification: "RESTRICTED" })
    ).toBe("restricted");
  });

  it("returns critical for known critical tool ids", () => {
    expect(
      classifyWorkbenchToolApprovalTier({ toolId: "golden.k8s.apply", dataClassification: "RESTRICTED" })
    ).toBe("critical");
  });

  it("respects WORKBENCH_CRITICAL_TOOL_IDS override", () => {
    const spy = vi.spyOn(process, "env", "get").mockReturnValue({
      ...process.env,
      WORKBENCH_CRITICAL_TOOL_IDS: "golden.foo, golden.bar ",
    } as any);

    expect(
      classifyWorkbenchToolApprovalTier({ toolId: "golden.foo", dataClassification: "RESTRICTED" })
    ).toBe("critical");
    expect(
      classifyWorkbenchToolApprovalTier({ toolId: "golden.k8s.apply", dataClassification: "RESTRICTED" })
    ).toBe("restricted");

    spy.mockRestore();
  });
});

