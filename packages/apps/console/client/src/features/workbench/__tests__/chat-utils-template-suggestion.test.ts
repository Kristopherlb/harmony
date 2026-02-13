/**
 * packages/apps/console/client/src/features/workbench/__tests__/chat-utils-template-suggestion.test.ts
 * Unit tests for template suggestion marker parsing (IMP-046).
 */
import { describe, expect, it } from "vitest";
import { getSuggestedTemplateIdFromMessage } from "../chat-utils";

describe("chat-utils getSuggestedTemplateIdFromMessage", () => {
  it("extracts <templateId> marker from assistant text", () => {
    const msg = {
      role: "assistant",
      parts: [{ type: "text", text: "Use this?\n<templateId>incident-response-basic</templateId>\n" }],
    };
    expect(getSuggestedTemplateIdFromMessage(msg)).toBe("incident-response-basic");
  });

  it("returns null when no marker present", () => {
    const msg = { role: "assistant", parts: [{ type: "text", text: "hello" }] };
    expect(getSuggestedTemplateIdFromMessage(msg)).toBeNull();
  });

  it("returns null when marker is empty", () => {
    const msg = { role: "assistant", parts: [{ type: "text", text: "<templateId>   </templateId>" }] };
    expect(getSuggestedTemplateIdFromMessage(msg)).toBeNull();
  });
});

