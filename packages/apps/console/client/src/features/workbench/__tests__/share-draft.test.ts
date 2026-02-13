/**
 * packages/apps/console/client/src/features/workbench/__tests__/share-draft.test.ts
 * Unit tests for workbench draft sharing (Phase 4.4.1).
 */
import { describe, expect, it } from "vitest";
import type { BlueprintDraft } from "../types";
import { buildShareDraftUrl, decodeShareDraftPayload, encodeShareDraftPayload } from "../share-draft";

describe("share-draft", () => {
  it("round-trips a draft through the share payload", () => {
    const draft: BlueprintDraft = {
      title: "Incident response",
      summary: "Open a Jira ticket and notify Slack.",
      nodes: [
        { id: "start", label: "Start", type: "start" },
        {
          id: "jira",
          label: "Create Jira ticket",
          type: "jira.createIssue",
          description: "Creates an incident ticket.",
          properties: { projectKey: "OPS", issueType: "Incident" },
        },
      ],
      edges: [{ source: "start", target: "jira", label: "then" }],
    };

    const payload = encodeShareDraftPayload(draft);
    const decoded = decodeShareDraftPayload(payload);
    expect(decoded).toEqual(draft);
  });

  it("builds a stable share URL with the payload", () => {
    const url = buildShareDraftUrl({
      origin: "https://console.example.com",
      payload: "v1:abc",
    });
    expect(url).toBe("https://console.example.com/workbench/shared?d=v1%3Aabc");
  });

  it("returns null for invalid payloads", () => {
    expect(decodeShareDraftPayload("nope")).toBeNull();
    expect(decodeShareDraftPayload("v1:")).toBeNull();
    expect(decodeShareDraftPayload("v2:abc")).toBeNull();
  });
});

