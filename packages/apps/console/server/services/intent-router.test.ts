import { describe, expect, it } from "vitest";
import { classifyChatIntent } from "./intent-router";

describe("intent-router", () => {
  it("classifies capability discovery intent", () => {
    expect(classifyChatIntent("What tools do you have for incident response?")).toBe("capability_discovery");
  });

  it("classifies workflow generation intent", () => {
    expect(classifyChatIntent("Create a workflow that pages on failed rollout.")).toBe("workflow_generation");
  });

  it("prefers generation intent when both discovery and generation signals exist", () => {
    expect(classifyChatIntent("Show tools and create a workflow for this incident")).toBe("workflow_generation");
  });

  it("returns default for ambiguous intent", () => {
    expect(classifyChatIntent("Can you help with incidents?")).toBe("default");
  });

  it("routes security capability availability questions to discovery intent", () => {
    expect(classifyChatIntent("What security tools do we have available?")).toBe("capability_discovery");
  });
});
