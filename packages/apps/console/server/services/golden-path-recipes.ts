import { z } from "zod";
import type { McpTool } from "@golden/mcp-server";

const RecipeStepSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  toolHints: z.array(z.string().min(1)).default([]),
});

export const GoldenPathRecipeSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  goalKeywords: z.array(z.string().min(1)).min(1),
  steps: z.array(RecipeStepSchema).min(1),
  preflightRules: z.array(z.string().min(1)).default([]),
  approvals: z.array(z.string().min(1)).default([]),
  rollbackNotes: z.array(z.string().min(1)).default([]),
});

export type GoldenPathRecipe = z.infer<typeof GoldenPathRecipeSchema>;

export const GOLDEN_PATH_RECIPES: GoldenPathRecipe[] = [
  {
    id: "incident_triage_comms",
    title: "Incident triage + communications",
    goalKeywords: ["incident", "outage", "triage", "alert", "oncall", "notify"],
    steps: [
      { id: "trigger", label: "Start from incident signal", toolHints: ["pagerduty", "alert"] },
      { id: "diagnose", label: "Collect diagnostics and context", toolHints: ["log", "grafana", "health"] },
      { id: "ticket", label: "Create/attach incident ticket", toolHints: ["jira", "issue"] },
      { id: "comms", label: "Notify stakeholders", toolHints: ["slack", "message"] },
    ],
    preflightRules: ["Require incident/service identifiers", "Validate notification destination"],
    approvals: ["Restricted tools require explicit approval"],
    rollbackNotes: ["Post status update when rollback/mitigation completes"],
  },
  {
    id: "progressive_rollout_verify_rollback",
    title: "Progressive rollout with verify + rollback",
    goalKeywords: ["rollout", "canary", "deploy", "blue green", "rollback", "verify"],
    steps: [
      { id: "deploy", label: "Start progressive deployment", toolHints: ["deploy", "canary", "blue"] },
      { id: "verify", label: "Run health/error budget checks", toolHints: ["health", "metrics", "probe"] },
      { id: "decision", label: "Promote or rollback", toolHints: ["approval", "rollback"] },
      { id: "announce", label: "Publish rollout outcome", toolHints: ["slack", "status"] },
    ],
    preflightRules: ["Require target environment", "Require rollback strategy input"],
    approvals: ["Critical operations may require peer approval"],
    rollbackNotes: ["Rollback to last healthy version and re-run verification"],
  },
  {
    id: "release_gate",
    title: "Release gate and certification",
    goalKeywords: ["release", "gate", "promote", "compliance", "certification", "approve"],
    steps: [
      { id: "build", label: "Build and test artifact", toolHints: ["build", "test", "ci"] },
      { id: "scan", label: "Run security/compliance checks", toolHints: ["scan", "slsa", "sbom"] },
      { id: "approve", label: "Collect approval decision", toolHints: ["approval", "policy"] },
      { id: "promote", label: "Promote release", toolHints: ["release", "deploy"] },
    ],
    preflightRules: ["Require target version and environment"],
    approvals: ["High-risk promotion actions require approval"],
    rollbackNotes: ["Block promotion when checks fail; attach diagnostics"],
  },
];

type RankedRecipe = {
  id: string;
  recipe: GoldenPathRecipe;
  baseScore: number;
  score: number;
  keywordHits: number;
  toolHits: number;
  diagnostics: {
    baseScore: number;
    outcomeWeight: number;
    feedbackWeight: number;
    intentWeight: number;
  };
  tradeoff: string;
};

export type RecommendationIntent = "capability_discovery" | "workflow_generation" | "default";

type RecommendationState = {
  outcomeWeightsByIntent: Map<RecommendationIntent, Map<string, number>>;
  feedbackWeightsByIntent: Map<RecommendationIntent, Map<string, number>>;
  lastSelectionByIntent: Map<
    RecommendationIntent,
    {
      primary: { recipeId: string; score: number } | null;
      alternatives: Array<{ recipeId: string; score: number; tradeoff: string }>;
      rationale: string[];
      selectedAt: string;
      recommendedTools: string[];
    }
  >;
};

const recommendationState: RecommendationState = {
  outcomeWeightsByIntent: new Map(),
  feedbackWeightsByIntent: new Map(),
  lastSelectionByIntent: new Map(),
};

function getOrCreateWeights(
  map: Map<RecommendationIntent, Map<string, number>>,
  intent: RecommendationIntent
): Map<string, number> {
  const existing = map.get(intent);
  if (existing) return existing;
  const created = new Map<string, number>();
  map.set(intent, created);
  return created;
}

function clampWeight(value: number): number {
  return Math.max(-25, Math.min(25, value));
}

function toIntent(value: string | undefined): RecommendationIntent {
  if (value === "capability_discovery") return "capability_discovery";
  if (value === "workflow_generation") return "workflow_generation";
  return "default";
}

function readWeight(
  map: Map<RecommendationIntent, Map<string, number>>,
  intent: RecommendationIntent,
  recipeId: string
): number {
  return getOrCreateWeights(map, intent).get(recipeId) ?? 0;
}

function addWeight(
  map: Map<RecommendationIntent, Map<string, number>>,
  input: { intent: RecommendationIntent; recipeId: string; delta: number }
): number {
  const bucket = getOrCreateWeights(map, input.intent);
  const next = clampWeight((bucket.get(input.recipeId) ?? 0) + input.delta);
  bucket.set(input.recipeId, next);
  return next;
}

function computeOutcomeWeightDelta(input: {
  status?: string;
  durationMs?: number;
  approvalTurnaroundMs?: number;
  preflightFailureCategory?: string;
}): number {
  const status = normalize(input.status ?? "");
  let delta = 0;
  if (status === "completed" || status === "success") delta += 3.5;
  if (status === "failed" || status === "cancelled") delta -= 3;

  if (typeof input.durationMs === "number" && Number.isFinite(input.durationMs)) {
    if (input.durationMs <= 5_000) delta += 1;
    if (input.durationMs >= 120_000) delta -= 1;
  }

  if (typeof input.approvalTurnaroundMs === "number" && Number.isFinite(input.approvalTurnaroundMs)) {
    if (input.approvalTurnaroundMs <= 30_000) delta += 0.5;
    if (input.approvalTurnaroundMs >= 180_000) delta -= 0.5;
  }

  const preflightCategory = normalize(input.preflightFailureCategory ?? "");
  if (preflightCategory.length > 0) delta -= 1.5;

  return delta;
}

function buildAlternativeTradeoff(input: {
  primary: RankedRecipe;
  alternative: RankedRecipe;
}): string {
  const scoreDelta = input.primary.score - input.alternative.score;
  if (scoreDelta <= 2) {
    return `Alternative ${input.alternative.recipe.title} is close (${input.alternative.score} vs ${input.primary.score}); consider it when strict ${input.alternative.recipe.goalKeywords[0]} constraints matter more.`;
  }
  return `Alternative ${input.alternative.recipe.title} is viable but ranked lower (${input.alternative.score} vs ${input.primary.score}) due to weaker keyword/tool alignment.`;
}

function normalize(text: string): string {
  return text.toLowerCase();
}

function scoreRecipe(input: {
  recipe: GoldenPathRecipe;
  message: string;
  toolNames: string[];
  intent: RecommendationIntent;
}): RankedRecipe {
  const message = normalize(input.message);
  const toolNames = input.toolNames.map(normalize);

  let keywordHits = 0;
  for (const keyword of input.recipe.goalKeywords) {
    if (message.includes(normalize(keyword))) keywordHits++;
  }

  const hintTokens = new Set<string>();
  for (const step of input.recipe.steps) {
    for (const hint of step.toolHints) hintTokens.add(normalize(hint));
  }

  let toolHits = 0;
  for (const token of hintTokens) {
    if (toolNames.some((name) => name.includes(token))) toolHits++;
  }

  const baseScore = keywordHits * 10 + toolHits * 3;
  const outcomeWeight = readWeight(recommendationState.outcomeWeightsByIntent, input.intent, input.recipe.id);
  const feedbackWeight = readWeight(recommendationState.feedbackWeightsByIntent, input.intent, input.recipe.id);
  const intentWeight = outcomeWeight + feedbackWeight;
  const score = baseScore + intentWeight;
  return {
    id: input.recipe.id,
    recipe: input.recipe,
    baseScore,
    score,
    keywordHits,
    toolHits,
    diagnostics: {
      baseScore,
      outcomeWeight,
      feedbackWeight,
      intentWeight,
    },
    tradeoff: "",
  };
}

export function selectGoldenPathRecipe(input: {
  userMessage: string;
  tools: Array<McpTool | { name: string }>;
  intent?: string;
  limit?: number;
}): {
  primary: RankedRecipe | null;
  alternatives: RankedRecipe[];
} {
  const limit = Math.max(1, Math.min(input.limit ?? 3, 5));
  const toolNames = input.tools.map((t) => t.name);
  const intent = toIntent(input.intent);

  const ranked = GOLDEN_PATH_RECIPES.map((recipe) =>
    scoreRecipe({
      recipe,
      message: input.userMessage,
      toolNames,
      intent,
    })
  )
    .filter((item) => item.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.baseScore !== a.baseScore) return b.baseScore - a.baseScore;
      if (b.keywordHits !== a.keywordHits) return b.keywordHits - a.keywordHits;
      if (b.toolHits !== a.toolHits) return b.toolHits - a.toolHits;
      return a.recipe.id.localeCompare(b.recipe.id);
    });

  if (ranked.length === 0) {
    recommendationState.lastSelectionByIntent.set(intent, {
      primary: null,
      alternatives: [],
      rationale: ["No recipe met minimum score threshold (>0)."],
      selectedAt: new Date().toISOString(),
      recommendedTools: [],
    });
    return { primary: null, alternatives: [] };
  }

  const [primary, ...rest] = ranked.slice(0, limit);
  const alternatives = rest.map((alternative) => ({
    ...alternative,
    tradeoff: buildAlternativeTradeoff({ primary, alternative }),
  }));
  recommendationState.lastSelectionByIntent.set(intent, {
    primary: { recipeId: primary.recipe.id, score: primary.score },
    alternatives: alternatives.map((a) => ({ recipeId: a.recipe.id, score: a.score, tradeoff: a.tradeoff })),
    rationale: [
      `Primary ${primary.recipe.id} selected with base=${primary.baseScore}, outcomeWeight=${primary.diagnostics.outcomeWeight}, feedbackWeight=${primary.diagnostics.feedbackWeight}.`,
      ...(alternatives.length > 0 ? ["Alternative paths available; trade-off prompts should be shown before generation."] : []),
    ],
    selectedAt: new Date().toISOString(),
    recommendedTools: primary.recipe.steps.flatMap((s) => s.toolHints).slice(0, 8),
  });
  return { primary, alternatives };
}

export function recordRecommendationOutcome(input: {
  intent: string;
  recipeId: string;
  status?: string;
  durationMs?: number;
  approvalTurnaroundMs?: number;
  preflightFailureCategory?: string;
}): { weight: number } {
  const intent = toIntent(input.intent);
  const delta = computeOutcomeWeightDelta({
    status: input.status,
    durationMs: input.durationMs,
    approvalTurnaroundMs: input.approvalTurnaroundMs,
    preflightFailureCategory: input.preflightFailureCategory,
  });
  const weight = addWeight(recommendationState.outcomeWeightsByIntent, {
    intent,
    recipeId: input.recipeId,
    delta,
  });
  return { weight };
}

export function recordRecipeFeedback(input: {
  intent: string;
  recipeId: string;
  feedback: "up" | "down";
}): { weight: number } {
  const intent = toIntent(input.intent);
  const delta = input.feedback === "up" ? 2 : -2;
  const weight = addWeight(recommendationState.feedbackWeightsByIntent, {
    intent,
    recipeId: input.recipeId,
    delta,
  });
  return { weight };
}

export function getRecommendationDiagnostics(input?: { intent?: string }): {
  intent: RecommendationIntent;
  weights: Record<string, number>;
  lastSelection: {
    primary: { recipeId: string; score: number } | null;
    alternatives: Array<{ recipeId: string; score: number; tradeoff: string }>;
    rationale: string[];
    selectedAt: string;
    recommendedTools: string[];
  } | null;
} {
  const intent = toIntent(input?.intent);
  const outcome = getOrCreateWeights(recommendationState.outcomeWeightsByIntent, intent);
  const feedback = getOrCreateWeights(recommendationState.feedbackWeightsByIntent, intent);
  const allIds = new Set<string>([...outcome.keys(), ...feedback.keys()]);
  const weights: Record<string, number> = {};
  for (const id of allIds) {
    weights[id] = (outcome.get(id) ?? 0) + (feedback.get(id) ?? 0);
  }
  return {
    intent,
    weights,
    lastSelection: recommendationState.lastSelectionByIntent.get(intent) ?? null,
  };
}

export function resetRecommendationScoringForTests(): void {
  recommendationState.outcomeWeightsByIntent.clear();
  recommendationState.feedbackWeightsByIntent.clear();
  recommendationState.lastSelectionByIntent.clear();
}
