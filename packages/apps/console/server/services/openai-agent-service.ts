import { convertToModelMessages, createUIMessageStream, streamText, tool, type UIMessage } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import type { McpTool } from "@golden/mcp-server";
import * as core from "@golden/core";
import type { GoldenContext, LlmBudgetPolicy } from "@golden/core";
import type { ToolCatalogTool } from "../agent/services/harmony-mcp-tool-service";
import { deriveDomainParts } from "../../client/src/features/capabilities/tool-taxonomy";
import { randomUUID } from "node:crypto";
import { getDefaultPricing, getLlmCostManager } from "./llm-cost-tracker";
import { unwrapCjsNamespace } from "../lib/cjs-interop";
import { classifyChatIntent } from "./intent-router";
import {
  buildBlueprintPlanningPrompt,
  buildReasoningSteeragePrompt,
  buildBlueprintSummarizerPrompt,
  type TemplateSummary,
} from "../agent/prompts/blueprint-generation";
import {
  getExecutionStatus,
  cancelExecution,
  isStatusQuery,
  isCancelQuery,
} from "../agent/execution-monitor";
import { selectGoldenPathRecipe } from "./golden-path-recipes";

// Define the schema for the workflow blueprint
// This MUST match the frontend BlueprintDraft type
const blueprintZodSchema = z.object({
  title: z.string(),
  summary: z.string(),
  nodes: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      type: z.string(),
      description: z.string().optional(),
      properties: z.record(z.unknown()).optional(),
    })
  ),
  edges: z.array(
    z.object({
      source: z.string(),
      target: z.string(),
      label: z.string().optional(),
    })
  ),
});

const defaultPricing = getDefaultPricing();
const llmCostManager = getLlmCostManager();
const corePkg = unwrapCjsNamespace<typeof core>(core as any);

function createConsoleGoldenContext(input: { initiatorId: string }): GoldenContext {
  return {
    app_id: "console",
    environment: process.env.NODE_ENV || "development",
    initiator_id: input.initiatorId,
    trace_id: randomUUID(),
    data_classification: "INTERNAL",
    cost_center: "",
  };
}

function parseUsdEnv(key: string): number | undefined {
  const raw = process.env[key];
  if (raw == null || raw.trim() === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function getBudgetPolicyFromEnv(): LlmBudgetPolicy | undefined {
  const perRun = parseUsdEnv("AI_BUDGET_USD_PER_RUN");
  if (typeof perRun === "number") return { hardLimitUsd: perRun, window: "run" };

  const perDay = parseUsdEnv("AI_BUDGET_USD_PER_DAY");
  if (typeof perDay === "number") return { hardLimitUsd: perDay, window: "day" };

  return undefined;
}

function estimateTokensFromUnknown(value: unknown): number {
  // Deterministic heuristic (no tokenizer dependency): ~1 token per ~4 chars.
  const s = typeof value === "string" ? value : JSON.stringify(value);
  return Math.max(1, Math.ceil((s?.length ?? 0) / 4));
}

function preflightModelSelection(input: {
  budgetKey: string;
  model: string;
  system: string;
  messages: unknown;
  expectedOutputTokens: number;
}): { model: string; estimatedUsd: number } {
  const budget = llmCostManager.getBudget(input.budgetKey);
  if (!budget) return { model: input.model, estimatedUsd: 0 };

  const inputTokens = estimateTokensFromUnknown(input.system) + estimateTokensFromUnknown(input.messages);
  const first = (corePkg as any).calculateLlmCostUsd({
    pricing: defaultPricing,
    provider: "openai",
    model: input.model,
    inputTokens,
    outputTokens: input.expectedOutputTokens,
  }).usd;

  if (first <= budget.hardLimitUsd) return { model: input.model, estimatedUsd: first };

  // Fallback: cheaper OpenAI model (local/free provider integration is out of scope for this service).
  const fallbackModel = "gpt-4o-mini";
  const second = (corePkg as any).calculateLlmCostUsd({
    pricing: defaultPricing,
    provider: "openai",
    model: fallbackModel,
    inputTokens,
    outputTokens: input.expectedOutputTokens,
  }).usd;

  if (second <= budget.hardLimitUsd) return { model: fallbackModel, estimatedUsd: second };

  throw new (corePkg as any).BudgetExceededError(
    `Estimated LLM cost exceeds budget for ${input.budgetKey}. ` +
      `budget=$${budget.hardLimitUsd.toFixed(4)}, est=$${second.toFixed(4)} (fallback=${fallbackModel})`,
  );
}

export function summarizeToolsForPrompt(tools: Array<McpTool & Partial<ToolCatalogTool>>, limit: number = 50): string {
  const sorted = [...tools].sort((a, b) => a.name.localeCompare(b.name)).slice(0, limit);
  return sorted
    .map((t) => {
      const schema = t.inputSchema as any;
      const props = schema?.properties && typeof schema.properties === "object"
        ? Object.keys(schema.properties).slice(0, 12).join(", ")
        : "";
      const req = Array.isArray(schema?.required) ? schema.required.slice(0, 12).join(", ") : "";
      const schemaHint =
        props || req ? ` (props: ${props || "-"}; required: ${req || "-"})` : "";
      const cls = (t as any).dataClassification ? ` [${(t as any).dataClassification}]` : "";
      const domain = (t as any).domain || deriveDomainParts(t.name).domain;
      const cost = (t as any).costFactor ? ` cost:${(t as any).costFactor}` : "";
      const tags = Array.isArray((t as any).tags) && (t as any).tags.length > 0
        ? ` tags:${(t as any).tags.slice(0, 6).join(",")}`
        : "";
      const hints = (t as any).aiHints as
        | {
            usageNotes?: string;
            constraints?: string[];
            negativeExamples?: string[];
          }
        | undefined;
      const usageNotes =
        typeof hints?.usageNotes === "string" && hints.usageNotes.trim().length > 0
          ? ` note:${hints.usageNotes.trim()}`
          : "";
      const constraints =
        Array.isArray(hints?.constraints) && hints.constraints.length > 0
          ? ` constraints:${hints.constraints.slice(0, 3).join(" | ")}`
          : "";
      const negatives =
        Array.isArray(hints?.negativeExamples) && hints.negativeExamples.length > 0
          ? ` avoid:${hints.negativeExamples.slice(0, 2).join(" | ")}`
          : "";
      return `- ${t.name}${cls} (${domain}${cost}${tags}): ${t.description}${schemaHint}${usageNotes}${constraints}${negatives}`;
    })
    .join("\n");
}

function tokenizeQuestion(question: string): string[] {
  const tokens = question
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((t) => t.trim())
    .filter((t) => t.length > 2);
  return Array.from(new Set(tokens));
}

function rankDiscoveryTools(input: {
  tools: Array<McpTool & Partial<ToolCatalogTool>>;
  userQuestion: string;
}): Array<McpTool & Partial<ToolCatalogTool>> {
  const tokens = tokenizeQuestion(input.userQuestion);
  if (tokens.length === 0) return [...input.tools].sort((a, b) => a.name.localeCompare(b.name));

  const scored = input.tools.map((tool) => {
    const searchable = [
      tool.name,
      tool.description,
      (tool as any).domain,
      (tool as any).subdomain,
      Array.isArray((tool as any).tags) ? (tool as any).tags.join(" ") : "",
    ]
      .filter((v): v is string => typeof v === "string")
      .join(" ")
      .toLowerCase();

    const tokenHits = tokens.reduce((acc, token) => (searchable.includes(token) ? acc + 1 : acc), 0);
    return { tool, tokenHits };
  });

  const hasHits = scored.some((row) => row.tokenHits > 0);
  const sorted = scored
    .sort((a, b) => {
      if (b.tokenHits !== a.tokenHits) return b.tokenHits - a.tokenHits;
      return a.tool.name.localeCompare(b.tool.name);
    })
    .map((row) => row.tool);
  return hasHits ? sorted.filter((tool, idx) => scored[idx].tokenHits > 0) : sorted;
}

export function buildCatalogGroundedDiscoveryResponse(input: {
  tools: Array<McpTool & Partial<ToolCatalogTool>>;
  userQuestion: string;
  maxTools?: number;
}): string {
  const ranked = rankDiscoveryTools({ tools: input.tools, userQuestion: input.userQuestion });
  if (ranked.length === 0) {
    return [
      "No tools discovered in the catalog right now.",
      "",
      "Next steps:",
      "1. Refresh catalog: POST /api/mcp/tools/refresh",
      "2. Verify Console catalog path: GET /api/mcp/tools",
      "3. Verify direct MCP server handshake (initialize + tools/list) before blueprint generation tests.",
      "",
      "Discovery mode only: I can list capabilities, but I will not draft a workflow in this turn.",
    ].join("\n");
  }

  const selected = ranked.slice(0, input.maxTools ?? 12);
  const grouped = new Map<string, Array<McpTool & Partial<ToolCatalogTool>>>();
  for (const tool of selected) {
    const domain = ((tool as any).domain as string | undefined)?.trim() || deriveDomainParts(tool.name).domain;
    const key = domain || "misc";
    const list = grouped.get(key) ?? [];
    list.push(tool);
    grouped.set(key, list);
  }

  const lines: string[] = [];
  lines.push("Catalog-grounded capabilities:");
  for (const [domain, tools] of [...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    lines.push(`- ${domain}`);
    for (const tool of tools.sort((a, b) => a.name.localeCompare(b.name))) {
      lines.push(`  - ${tool.name}: ${tool.description}`);
    }
  }
  lines.push("");
  lines.push("Discovery mode only: I can list capabilities and use-cases, but I will not draft a workflow in this turn.");
  return lines.join("\n");
}

export function normalizeIncomingMessages(messages: unknown): UIMessage[] {
  if (!Array.isArray(messages)) return [];

  return messages.map((m: any, idx: number) => {
    const id = typeof m?.id === "string" ? m.id : `msg-${idx}`;
    const role = m?.role === "user" || m?.role === "assistant" || m?.role === "system" ? m.role : "user";

    // Preferred (AI SDK v5+): parts[]
    if (Array.isArray(m?.parts)) {
      return {
        id,
        role,
        parts: m.parts,
        metadata: m?.metadata,
      } as UIMessage;
    }

    // Legacy / mixed shapes: content string
    const content = typeof m?.content === "string" ? m.content : typeof m?.text === "string" ? m.text : "";
    return {
      id,
      role,
      parts: [{ type: "text", text: content }],
      metadata: m?.metadata,
    } as UIMessage;
  });
}

function extractTextParts(message: UIMessage | undefined): string {
  if (!message?.parts) return "";
  return message.parts
    .filter((p: any) => p?.type === "text" && typeof p?.text === "string")
    .map((p: any) => p.text)
    .join("\n")
    .trim();
}

function userConfirmedSteerage(messageText: string): boolean {
  const t = (messageText ?? "").toLowerCase();
  return /\b(yes|yep|looks good|go ahead|proceed|continue|generate|build it|do it)\b/.test(t);
}

function containsSteerageCheckpoint(messageText: string): boolean {
  return /<steerageCheckpoint/i.test(messageText ?? "");
}

function shouldRunReasoningSteerage(input: {
  intent: string;
  hasCurrentDraft: boolean;
  lastUserText: string;
  lastAssistantText: string;
  hasCompetingAlternatives: boolean;
}): boolean {
  if (input.intent !== "workflow_generation") return false;
  if (input.hasCurrentDraft) return false;
  if (input.hasCompetingAlternatives) return true;
  const priorCheckpoint = containsSteerageCheckpoint(input.lastAssistantText);
  if (priorCheckpoint && userConfirmedSteerage(input.lastUserText)) return false;
  if (priorCheckpoint) return false;

  const text = (input.lastUserText ?? "").toLowerCase();
  const looksComplex =
    text.length > 140 ||
    /\b(and then|after that|if .* then|triage|rollback|approval|multi|complex|incident|release)\b/.test(text);
  return looksComplex;
}

const explainStepZodSchema = z.object({
  nodeId: z.string(),
  explanation: z.string(),
});

export const OpenAIAgentService = {
  async generateBlueprint(input: {
    messages: any[];
    tools?: Array<McpTool & Partial<ToolCatalogTool>>;
    budgetKey?: string;
    currentDraft?: { title: string; summary: string; nodes: unknown[]; edges: unknown[] } | null;
    templatesSummary?: TemplateSummary[];
    /** Active workflow run ID for status/cancel context (Phase 4.3.3) */
    activeWorkflowId?: string;
  }) {
    const toolsList = input.tools ?? [];
    const toolsSummary = toolsList.length > 0 ? summarizeToolsForPrompt(toolsList, 80) : "- (no tools available)";

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        writer.write({ type: "start" });

        const budgetKey = typeof input.budgetKey === "string" && input.budgetKey.length > 0 ? input.budgetKey : "session:anonymous";
        const ctx = createConsoleGoldenContext({ initiatorId: budgetKey });

        try {
          await (corePkg as any).withGoldenSpan("console.chat.generate_blueprint", ctx, "REASONER", async (rootSpan) => {
            rootSpan.setAttribute("ai.budget.key", budgetKey);
            rootSpan.setAttribute("ai.request.kind", "generate_blueprint");
            rootSpan.setAttribute("ai.tools.count", toolsList.length);

            const budget = getBudgetPolicyFromEnv();
            if (budget) {
              llmCostManager.setBudget(budgetKey, budget);
              rootSpan.setAttribute("ai.budget.window", budget.window);
              rootSpan.setAttribute("ai.budget.hard_limit_usd", budget.hardLimitUsd);
            }

            const uiMessages = normalizeIncomingMessages(input.messages);
            const originalLastUserMessage = [...uiMessages].reverse().find((m) => m.role === "user");
            const originalLastUserTextPart = originalLastUserMessage?.parts?.find(
              (p: any) => p.type === "text" && typeof p.text === "string"
            );
            const originalLastUserText = originalLastUserTextPart?.text ?? "";

            // Phase 4.3.3: Inject execution status or cancel result when user asks and we have activeWorkflowId.
            const activeWorkflowId = input.activeWorkflowId;
            if (activeWorkflowId) {
              const lastUserIdx = [...uiMessages].reverse().findIndex((m) => m.role === "user");
              const lastUserMessage =
                lastUserIdx >= 0 ? uiMessages[uiMessages.length - 1 - lastUserIdx] : null;
              const textPart = lastUserMessage?.parts?.find((p: any) => p.type === "text" && typeof p.text === "string");
              const lastText = textPart?.text ?? "";
              if (isCancelQuery(lastText)) {
                const result = await cancelExecution(activeWorkflowId);
                const context = result.ok
                  ? "The workflow was canceled."
                  : `Cancel failed: ${result.error}`;
                if (textPart) {
                  textPart.text = `[Execution: ${context}]\n\n${lastText}`;
                }
              } else if (isStatusQuery(lastText)) {
                const statusText = await getExecutionStatus(activeWorkflowId);
                if (textPart) {
                  textPart.text = `[Current workflow execution:\n${statusText}\n]\n\n${lastText}`;
                }
              }
            }

            const modelMessages = await convertToModelMessages(uiMessages);
            const lastUserMessage = [...uiMessages].reverse().find((m) => m.role === "user");
            const lastUserTextPart = lastUserMessage?.parts?.find(
              (p: any) => p.type === "text" && typeof p.text === "string"
            );
            const intent = classifyChatIntent(originalLastUserText || lastUserTextPart?.text || "");
            rootSpan.setAttribute("ai.intent", intent);

            const recipeSelection = selectGoldenPathRecipe({
              userMessage: originalLastUserText || lastUserTextPart?.text || "",
              tools: toolsList,
              intent,
              limit: 3,
            });
            if (recipeSelection.primary) {
              rootSpan.setAttribute("ai.recipe.primary_id", recipeSelection.primary.recipe.id);
              rootSpan.setAttribute("ai.recipe.primary_score", recipeSelection.primary.score);
            }

            if (intent === "capability_discovery") {
              const discoveryMessage = buildCatalogGroundedDiscoveryResponse({
                tools: toolsList,
                userQuestion: originalLastUserText || lastUserTextPart?.text || "",
              });
              writer.write({
                type: "text",
                text: discoveryMessage,
              } as any);
              return;
            }

            const lastAssistantMessage = [...uiMessages].reverse().find((m) => m.role === "assistant");
            const lastAssistantText = extractTextParts(lastAssistantMessage);
            if (
              shouldRunReasoningSteerage({
                intent,
                hasCurrentDraft: Boolean(input.currentDraft && input.currentDraft.nodes.length > 0),
                lastUserText: originalLastUserText || lastUserTextPart?.text || "",
                lastAssistantText,
                hasCompetingAlternatives:
                  recipeSelection.alternatives.length > 0 &&
                  recipeSelection.primary != null &&
                  recipeSelection.alternatives[0].score >= recipeSelection.primary.score - 2,
              })
            ) {
              const steeragePrompt = buildReasoningSteeragePrompt({
                userMessage: originalLastUserText || lastUserTextPart?.text || "",
                currentDraft: input.currentDraft ?? null,
                recipeContext: recipeSelection.primary
                  ? {
                      primary: {
                        id: recipeSelection.primary.recipe.id,
                        title: recipeSelection.primary.recipe.title,
                        why:
                          `keywordHits=${recipeSelection.primary.keywordHits}, ` +
                          `toolHits=${recipeSelection.primary.toolHits}, ` +
                          `outcomeWeight=${recipeSelection.primary.diagnostics.outcomeWeight}, ` +
                          `feedbackWeight=${recipeSelection.primary.diagnostics.feedbackWeight}`,
                        chain: recipeSelection.primary.recipe.steps.map((s) => s.label),
                      },
                      alternatives: recipeSelection.alternatives.map((alt) => ({
                        id: alt.recipe.id,
                        title: alt.recipe.title,
                        why: `${alt.tradeoff} (score=${alt.score})`,
                      })),
                    }
                  : { primary: null, alternatives: [] },
              });
              const requestedModel = process.env.AI_MODEL_NAME || "gpt-4o";
              const steerageModel = preflightModelSelection({
                budgetKey,
                model: requestedModel,
                system: steeragePrompt,
                messages: modelMessages,
                expectedOutputTokens: 500,
              }).model;

              await (corePkg as any).withGoldenSpan("console.chat.llm.steerage", ctx, "REASONER", async (span) => {
                span.setAttribute("ai.provider", "openai");
                span.setAttribute("ai.model", steerageModel);
                span.setAttribute("ai.step", "steerage");
                const steerage = streamText(
                  {
                    model: openai(steerageModel),
                    system: steeragePrompt,
                    messages: modelMessages,
                    onFinish: (result: any) => {
                      const usage = result?.usage;
                      const promptTokens = usage?.promptTokens ?? usage?.inputTokens ?? usage?.prompt_tokens;
                      const completionTokens = usage?.completionTokens ?? usage?.outputTokens ?? usage?.completion_tokens;
                      if (typeof promptTokens === "number" && typeof completionTokens === "number") {
                        span.setAttribute("ai.usage.input_tokens", promptTokens);
                        span.setAttribute("ai.usage.output_tokens", completionTokens);
                        const entry = llmCostManager.recordUsage({
                          budgetKey,
                          provider: "openai",
                          model: steerageModel,
                          inputTokens: promptTokens,
                          outputTokens: completionTokens,
                        });
                        const totals = llmCostManager.getTotals({ budgetKey });
                        span.setAttribute("ai.cost.usd", entry.usd);
                        span.setAttribute("ai.cost.total_usd", totals.usd);
                      }
                    },
                  } as any
                );
                writer.merge(steerage.toUIMessageStream({ sendStart: false }));
                await steerage.response;
              });
              return;
            }

            const blueprintPlanningPrompt = buildBlueprintPlanningPrompt({
              toolsSummary,
              templatesSummary: input.templatesSummary ?? [],
              currentDraft: input.currentDraft ?? null,
              recipeContext: recipeSelection.primary
                ? {
                    primary: {
                      id: recipeSelection.primary.recipe.id,
                      title: recipeSelection.primary.recipe.title,
                      why:
                        `keywordHits=${recipeSelection.primary.keywordHits}, ` +
                        `toolHits=${recipeSelection.primary.toolHits}, ` +
                        `outcomeWeight=${recipeSelection.primary.diagnostics.outcomeWeight}, ` +
                        `feedbackWeight=${recipeSelection.primary.diagnostics.feedbackWeight}`,
                      chain: recipeSelection.primary.recipe.steps.map((s) => s.label),
                      preflight: recipeSelection.primary.recipe.preflightRules,
                      approvals: recipeSelection.primary.recipe.approvals,
                    },
                    alternatives: recipeSelection.alternatives.map((alt) => ({
                      id: alt.recipe.id,
                      title: alt.recipe.title,
                      why: `${alt.tradeoff} (score=${alt.score})`,
                    })),
                  }
                : { primary: null, alternatives: [] },
            });
            const summarizerPrompt = buildBlueprintSummarizerPrompt();

            // Step 1: force a tool call so the UI always receives a structured draft.
            const requestedModel = process.env.AI_MODEL_NAME || "gpt-4o";
            const planningModel = preflightModelSelection({
              budgetKey,
              model: requestedModel,
              system: blueprintPlanningPrompt,
              messages: modelMessages,
              expectedOutputTokens: 1200,
            }).model;

            const planningMessages = await (corePkg as any).withGoldenSpan(
              "console.chat.llm.planning",
              ctx,
              "REASONER",
              async (span) => {
              span.setAttribute("ai.provider", "openai");
              span.setAttribute("ai.model", planningModel);
              span.setAttribute("ai.step", "planning");

              const planning = streamText(
                {
                  model: openai(planningModel),
                  system: blueprintPlanningPrompt,
                  messages: modelMessages,
                  toolChoice: "required",
                  tools: {
                    proposeWorkflow: tool({
                      description: "Propose a workflow blueprint draft the user can refine.",
                      inputSchema: blueprintZodSchema,
                      execute: async (draft) => draft,
                    }),
                    explainStep: tool({
                      description: "Explain why a specific step was added to the workflow. Use when the user asks 'Why did you add this step?' or similar.",
                      inputSchema: explainStepZodSchema,
                      execute: async (input) => input,
                    }),
                  },
                  onFinish: (result: any) => {
                    const usage = result?.usage;
                    const promptTokens = usage?.promptTokens ?? usage?.inputTokens ?? usage?.prompt_tokens;
                    const completionTokens = usage?.completionTokens ?? usage?.outputTokens ?? usage?.completion_tokens;
                    if (typeof promptTokens === "number" && typeof completionTokens === "number") {
                      span.setAttribute("ai.usage.input_tokens", promptTokens);
                      span.setAttribute("ai.usage.output_tokens", completionTokens);

                      const entry = llmCostManager.recordUsage({
                        budgetKey,
                        provider: "openai",
                        model: planningModel,
                        inputTokens: promptTokens,
                        outputTokens: completionTokens,
                      });
                      const totals = llmCostManager.getTotals({ budgetKey });

                      span.setAttribute("ai.cost.usd", entry.usd);
                      span.setAttribute("ai.cost.total_usd", totals.usd);
                      console.debug("[llm.cost]", { budgetKey, step: "planning", entry, totals });
                    }
                  },
                } as any,
              );

              writer.merge(planning.toUIMessageStream({ sendFinish: false }));
              return (await planning.response).messages;
            });

            // Step 2: produce a human-readable summary + refinement questions.
            const summaryModel = preflightModelSelection({
              budgetKey,
              model: requestedModel,
              system: summarizerPrompt,
              messages: [...modelMessages, ...planningMessages],
              expectedOutputTokens: 800,
            }).model;

            await (corePkg as any).withGoldenSpan("console.chat.llm.summary", ctx, "REASONER", async (span) => {
              span.setAttribute("ai.provider", "openai");
              span.setAttribute("ai.model", summaryModel);
              span.setAttribute("ai.step", "summary");

              const summary = streamText(
                {
                  model: openai(summaryModel),
                  system: summarizerPrompt,
                  messages: [...modelMessages, ...planningMessages],
                  onFinish: (result: any) => {
                    const usage = result?.usage;
                    const promptTokens = usage?.promptTokens ?? usage?.inputTokens ?? usage?.prompt_tokens;
                    const completionTokens = usage?.completionTokens ?? usage?.outputTokens ?? usage?.completion_tokens;
                    if (typeof promptTokens === "number" && typeof completionTokens === "number") {
                      span.setAttribute("ai.usage.input_tokens", promptTokens);
                      span.setAttribute("ai.usage.output_tokens", completionTokens);

                      const entry = llmCostManager.recordUsage({
                        budgetKey,
                        provider: "openai",
                        model: summaryModel,
                        inputTokens: promptTokens,
                        outputTokens: completionTokens,
                      });
                      const totals = llmCostManager.getTotals({ budgetKey });

                      span.setAttribute("ai.cost.usd", entry.usd);
                      span.setAttribute("ai.cost.total_usd", totals.usd);
                      console.debug("[llm.cost]", { budgetKey, step: "summary", entry, totals });
                    }
                  },
                } as any,
              );

              writer.merge(summary.toUIMessageStream({ sendStart: false }));
              await summary.response;
            });
          });
        } catch (err: any) {
          // Never return an empty response: emit a visible error message for the UI.
          const msg = err?.message ? String(err.message) : String(err);
          writer.write({
            type: "text",
            text:
              "Chat generation failed while preparing the prompt.\n\n" +
              "This usually means the client sent an unexpected message shape.\n\n" +
              `Error: ${msg}`,
          } as any);
        }
      },
    });

    return stream;
  },
};

