/**
 * packages/apps/console/server/agent/prompts/blueprint-generation.test.ts
 * Unit tests for blueprint generation prompts (Phase 4.2.1).
 */
import { describe, expect, it } from "vitest";
import {
  buildBlueprintPlanningPrompt,
  buildBlueprintSummarizerPrompt,
  buildCapabilityDiscoveryPrompt,
  buildReasoningSteeragePrompt,
} from "./blueprint-generation";

describe("blueprint-generation prompts", () => {
  it("buildBlueprintPlanningPrompt includes system role and tool catalog", () => {
    const prompt = buildBlueprintPlanningPrompt({
      toolsSummary: "- jira.createIssue: Create Jira issue",
    });
    expect(prompt).toContain("<system_role>");
    expect(prompt).toContain("jira.createIssue");
  });

  it("buildBlueprintPlanningPrompt includes template block when templates provided", () => {
    const prompt = buildBlueprintPlanningPrompt({
      toolsSummary: "- tool.a",
      templatesSummary: [
        { id: "incident-response-basic", name: "Incident Response", description: "Slack + Jira" },
      ],
    });
    expect(prompt).toContain("AVAILABLE TEMPLATES");
    expect(prompt).toContain("incident-response-basic");
    expect(prompt).toContain("Incident Response");
    expect(prompt).toContain("<templateId>");
  });

  it("buildBlueprintPlanningPrompt includes current draft block when draft provided", () => {
    const prompt = buildBlueprintPlanningPrompt({
      toolsSummary: "- tool.a",
      currentDraft: {
        title: "My Workflow",
        summary: "Test",
        nodes: [{ id: "n1", label: "Step 1", type: "trigger" }],
        edges: [],
      },
    });
    expect(prompt).toContain("CURRENT DRAFT");
    expect(prompt).toContain("My Workflow");
    expect(prompt).toContain("ITERATION MODE");
  });

  it("buildBlueprintPlanningPrompt includes EXPLAIN MODE", () => {
    const prompt = buildBlueprintPlanningPrompt({ toolsSummary: "- tool.a" });
    expect(prompt).toContain("EXPLAIN MODE");
    expect(prompt).toContain("explainStep");
  });

  it("buildBlueprintPlanningPrompt includes recipe-first context when provided", () => {
    const prompt = buildBlueprintPlanningPrompt({
      toolsSummary: "- tool.a",
      recipeContext: {
        primary: {
          id: "incident_triage_comms",
          title: "Incident triage + comms",
          why: "Matches outage triage intent",
          chain: ["start", "golden.pagerduty.fetch", "golden.slack.post"],
          preflight: ["serviceId required"],
          approvals: ["RESTRICTED tools require approval"],
        },
        alternatives: [{ id: "release_gate", title: "Release gate", why: "Fewer incident checks" }],
      },
    });
    expect(prompt).toContain("RECIPE-FIRST CONTEXT");
    expect(prompt).toContain("incident_triage_comms");
    expect(prompt).toContain("Alternatives:");
  });

  it("buildBlueprintSummarizerPrompt returns non-empty string", () => {
    const prompt = buildBlueprintSummarizerPrompt();
    expect(prompt).toBeTruthy();
    expect(prompt).toContain("explainStep");
  });

  it("buildCapabilityDiscoveryPrompt includes discovery instructions and tools", () => {
    const prompt = buildCapabilityDiscoveryPrompt({
      toolsSummary: "- golden.jira.issue.search: Search Jira",
    });
    expect(prompt).toContain("capability discovery");
    expect(prompt).toContain("Do NOT call workflow-generation tools");
    expect(prompt).toContain("golden.jira.issue.search");
  });

  it("buildReasoningSteeragePrompt enforces checkpoint marker", () => {
    const prompt = buildReasoningSteeragePrompt({
      userMessage: "Design an outage workflow",
      currentDraft: null,
      recipeContext: {
        primary: {
          id: "incident_triage_comms",
          title: "Incident triage + comms",
          why: "Fits outage handling",
          chain: ["start", "golden.pagerduty.fetch", "golden.slack.post"],
        },
      },
    });
    expect(prompt).toContain("DO NOT generate a workflow draft");
    expect(prompt).toContain("<steerageCheckpoint status=\"pending\">confirm-to-generate</steerageCheckpoint>");
  });
});
