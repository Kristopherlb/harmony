import { beforeEach, describe, expect, it } from "vitest";
import type { McpTool } from "@golden/mcp-server";
import {
  GOLDEN_PATH_RECIPES,
  GoldenPathRecipeSchema,
  getRecommendationDiagnostics,
  recordRecipeFeedback,
  recordRecommendationOutcome,
  resetRecommendationScoringForTests,
  selectGoldenPathRecipe,
} from "./golden-path-recipes";

describe("golden-path-recipes", () => {
  beforeEach(() => {
    resetRecommendationScoringForTests();
  });

  it("validates all seeded recipes against schema", () => {
    for (const recipe of GOLDEN_PATH_RECIPES) {
      const parsed = GoldenPathRecipeSchema.safeParse(recipe);
      expect(parsed.success).toBe(true);
    }
  });

  it("selects incident recipe deterministically when outage signals and tools match", () => {
    const tools: McpTool[] = [
      { name: "golden.pagerduty.fetch_incident", description: "Fetch incident", inputSchema: { type: "object" } } as any,
      { name: "golden.slack.post_message", description: "Post message", inputSchema: { type: "object" } } as any,
      { name: "golden.jira.create_issue", description: "Create issue", inputSchema: { type: "object" } } as any,
    ];

    const selected = selectGoldenPathRecipe({
      userMessage: "We have a production outage, triage and notify stakeholders quickly.",
      tools,
      limit: 2,
    });

    expect(selected.primary?.recipe.id).toBe("incident_triage_comms");
    expect(selected.alternatives.length).toBeLessThanOrEqual(1);
  });

  it("returns deterministic tie-break ordering by id", () => {
    const tools: McpTool[] = [
      { name: "golden.slack.post_message", description: "Post message", inputSchema: { type: "object" } } as any,
      { name: "golden.github.create_release", description: "Create release", inputSchema: { type: "object" } } as any,
      { name: "golden.deploy.blue_green", description: "Deploy", inputSchema: { type: "object" } } as any,
      { name: "golden.health.check", description: "Health check", inputSchema: { type: "object" } } as any,
    ];

    const first = selectGoldenPathRecipe({
      userMessage: "Prepare release and verify rollout with rollback plan.",
      tools,
      limit: 3,
    });
    const second = selectGoldenPathRecipe({
      userMessage: "Prepare release and verify rollout with rollback plan.",
      tools,
      limit: 3,
    });

    expect(first.primary?.id).toBe(second.primary?.id);
    expect(first.alternatives.map((a) => a.id)).toEqual(second.alternatives.map((a) => a.id));
  });

  it("boosts recipe ranking from positive local outcomes and feedback", () => {
    recordRecommendationOutcome({
      intent: "workflow_generation",
      recipeId: "release_gate",
      status: "completed",
      durationMs: 4_500,
      approvalTurnaroundMs: 1_500,
    });
    recordRecipeFeedback({
      intent: "workflow_generation",
      recipeId: "release_gate",
      feedback: "up",
    });

    const tools: McpTool[] = [
      { name: "golden.deploy.blue_green", description: "Deploy", inputSchema: { type: "object" } } as any,
      { name: "golden.github.create_release", description: "Release", inputSchema: { type: "object" } } as any,
      { name: "golden.health.check", description: "Health", inputSchema: { type: "object" } } as any,
    ];
    const selected = selectGoldenPathRecipe({
      userMessage: "Need to ship release with verify and rollback safeguards",
      tools,
      intent: "workflow_generation",
      limit: 3,
    });

    const diagnostics = getRecommendationDiagnostics({ intent: "workflow_generation" });
    expect(diagnostics.weights.release_gate).toBeGreaterThan(0);
    const releaseCandidate = [selected.primary, ...selected.alternatives].find(
      (candidate) => candidate?.recipe.id === "release_gate"
    );
    expect(releaseCandidate?.diagnostics.outcomeWeight).toBeGreaterThan(0);
    expect(releaseCandidate?.diagnostics.feedbackWeight).toBeGreaterThan(0);
  });

  it("returns proactive trade-off diagnostics when alternatives are close", () => {
    const tools: McpTool[] = [
      { name: "golden.deploy.blue_green", description: "Deploy", inputSchema: { type: "object" } } as any,
      { name: "golden.slack.post_message", description: "Slack", inputSchema: { type: "object" } } as any,
      { name: "golden.health.check", description: "Health", inputSchema: { type: "object" } } as any,
      { name: "golden.release.promote", description: "Release", inputSchema: { type: "object" } } as any,
    ];
    const selected = selectGoldenPathRecipe({
      userMessage: "Plan a rollout and release gate with rollback and announcements",
      tools,
      intent: "workflow_generation",
      limit: 3,
    });

    expect(selected.primary).toBeTruthy();
    expect(selected.alternatives.length).toBeGreaterThan(0);
    expect(selected.alternatives[0].tradeoff).toContain("Alternative");
  });

  it("tracks explainability diagnostics for last selection by intent", () => {
    const tools: McpTool[] = [
      { name: "golden.pagerduty.fetch_incident", description: "Incident", inputSchema: { type: "object" } } as any,
      { name: "golden.slack.post_message", description: "Slack", inputSchema: { type: "object" } } as any,
    ];
    selectGoldenPathRecipe({
      userMessage: "Help triage an outage and notify the team",
      tools,
      intent: "workflow_generation",
      limit: 2,
    });

    const diagnostics = getRecommendationDiagnostics({ intent: "workflow_generation" });
    expect(diagnostics.intent).toBe("workflow_generation");
    expect(diagnostics.lastSelection?.primary.recipeId).toBeTruthy();
    expect(diagnostics.lastSelection?.rationale.length).toBeGreaterThan(0);
  });
});
