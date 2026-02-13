/**
 * packages/apps/console/client/src/features/workbench/__tests__/template-insertion.test.ts
 * Unit tests for template → BlueprintDraft conversion (Phase 4.1.4).
 */
import { describe, expect, it } from "vitest";
import { templateToBlueprintDraft, type TemplateDraftLike } from "../template-insertion";

describe("template-insertion", () => {
  it("converts template to BlueprintDraft and strips library-only metadata", () => {
    const template: TemplateDraftLike = {
      id: "incident-response-basic",
      name: "Incident Response (Basic)",
      description: "Slack alert plus Jira ticket.",
      domain: "operations",
      subdomain: "incidents",
      tags: ["incident", "slack", "jira"],
      author: "Platform",
      version: "1.0.0",
      title: "Incident Response (Basic)",
      summary: "Receive alert, create Jira ticket, notify in Slack.",
      nodes: [
        { id: "n1", label: "Slack alert", type: "trigger" },
        { id: "n2", label: "Create Jira ticket", type: "action", description: "Create ticket" },
      ],
      edges: [{ source: "n1", target: "n2" }],
    };

    const draft = templateToBlueprintDraft(template);

    expect(draft.title).toBe("Incident Response (Basic)");
    expect(draft.summary).toBe("Receive alert, create Jira ticket, notify in Slack.");
    expect(draft.nodes).toHaveLength(2);
    expect(draft.nodes[0]).toEqual({ id: "n1", label: "Slack alert", type: "trigger" });
    expect(draft.nodes[1]).toEqual({
      id: "n2",
      label: "Create Jira ticket",
      type: "action",
      description: "Create ticket",
    });
    expect(draft.edges).toEqual([{ source: "n1", target: "n2" }]);
    expect((draft as Record<string, unknown>).id).toBeUndefined();
    expect((draft as Record<string, unknown>).domain).toBeUndefined();
    expect((draft as Record<string, unknown>).tags).toBeUndefined();
  });

  it("preserves optional node properties and edge labels", () => {
    const template: TemplateDraftLike = {
      id: "x",
      name: "X",
      description: "X",
      title: "X",
      summary: "X",
      nodes: [
        { id: "n1", label: "A", type: "a", properties: { key: "value" } },
      ],
      edges: [{ source: "n1", target: "n1", label: "loop" }],
    };

    const draft = templateToBlueprintDraft(template);

    expect(draft.nodes[0].properties).toEqual({ key: "value" });
    expect(draft.edges[0].label).toBe("loop");
  });
});
