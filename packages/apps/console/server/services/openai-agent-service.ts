import { convertToModelMessages, createUIMessageStream, streamText, tool, type UIMessage } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import type { McpTool } from "@golden/mcp-server";
import {
  BudgetExceededError,
  calculateLlmCostUsd,
  createInMemoryLlmCostManager,
  getDefaultLlmPricing,
  withGoldenSpan,
  type GoldenContext,
  type LlmBudgetPolicy,
} from "@golden/core";
import type { ToolCatalogTool } from "../agent/services/harmony-mcp-tool-service";
import { deriveDomainParts } from "../../client/src/features/capabilities/tool-taxonomy";
import { randomUUID } from "node:crypto";

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

const defaultPricing = getDefaultLlmPricing();
const llmCostManager = createInMemoryLlmCostManager({ pricing: defaultPricing });

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
  const first = calculateLlmCostUsd({
    pricing: defaultPricing,
    provider: "openai",
    model: input.model,
    inputTokens,
    outputTokens: input.expectedOutputTokens,
  }).usd;

  if (first <= budget.hardLimitUsd) return { model: input.model, estimatedUsd: first };

  // Fallback: cheaper OpenAI model (local/free provider integration is out of scope for this service).
  const fallbackModel = "gpt-4o-mini";
  const second = calculateLlmCostUsd({
    pricing: defaultPricing,
    provider: "openai",
    model: fallbackModel,
    inputTokens,
    outputTokens: input.expectedOutputTokens,
  }).usd;

  if (second <= budget.hardLimitUsd) return { model: fallbackModel, estimatedUsd: second };

  throw new BudgetExceededError(
    `Estimated LLM cost exceeds budget for ${input.budgetKey}. ` +
      `budget=$${budget.hardLimitUsd.toFixed(4)}, est=$${second.toFixed(4)} (fallback=${fallbackModel})`,
  );
}

function summarizeToolsForPrompt(tools: Array<McpTool & Partial<ToolCatalogTool>>, limit: number = 50): string {
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
      return `- ${t.name}${cls} (${domain}${cost}${tags}): ${t.description}${schemaHint}`;
    })
    .join("\n");
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

export const OpenAIAgentService = {
  async generateBlueprint(input: {
    messages: any[];
    tools?: Array<McpTool & Partial<ToolCatalogTool>>;
    budgetKey?: string;
  }) {
    const toolsList = input.tools ?? [];
    const toolsSummary = toolsList.length > 0 ? summarizeToolsForPrompt(toolsList, 80) : "- (no tools available)";

    const blueprintPlanningPrompt = buildBlueprintPlanningPrompt({ toolsSummary });
    const summarizerPrompt = buildBlueprintSummarizerPrompt();

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        writer.write({ type: "start" });

        const budgetKey = typeof input.budgetKey === "string" && input.budgetKey.length > 0 ? input.budgetKey : "session:anonymous";
        const ctx = createConsoleGoldenContext({ initiatorId: budgetKey });

        try {
          await withGoldenSpan("console.chat.generate_blueprint", ctx, "REASONER", async (rootSpan) => {
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
            const modelMessages = await convertToModelMessages(uiMessages);

            // Step 1: force a tool call so the UI always receives a structured draft.
            const requestedModel = process.env.AI_MODEL_NAME || "gpt-4o";
            const planningModel = preflightModelSelection({
              budgetKey,
              model: requestedModel,
              system: blueprintPlanningPrompt,
              messages: modelMessages,
              expectedOutputTokens: 1200,
            }).model;

            const planningMessages = await withGoldenSpan("console.chat.llm.planning", ctx, "REASONER", async (span) => {
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

            await withGoldenSpan("console.chat.llm.summary", ctx, "REASONER", async (span) => {
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

export function buildBlueprintPlanningPrompt(input: { toolsSummary: string }): string {
  return `
<system_role>
You are the AI Architect for a Workflow Automation Platform.
</system_role>

<engineering_principles>
- Prefer deterministic, editable drafts over perfect completeness.
- Do not invent tool IDs; use only IDs from the available tool catalog.
- Keep workflow structure stable unless the user explicitly asks to restructure it.
- When refining an existing node, change only that node's properties unless asked otherwise.
</engineering_principles>

<instructions>
AVAILABLE HARMONY MCP TOOLS (use these IDs for node.type):
${input.toolsSummary}

PRIMARY TASK (default):
- Analyze the user's request.
- Construct a logical workflow using the available tools.
- ALWAYS start with a Trigger node if possible.
- Use explicit edges to connect nodes.
- Prefer fewer, higher-signal steps; avoid overfitting.
- If a tool is missing, choose the closest available tool id and record missing assumptions in node.description.

NODE REFINEMENT MODE:
If the user message contains a <workbench_node_refinement>...</workbench_node_refinement> JSON payload:
- Treat this as a request to configure an existing node inside the provided draft.
- The payload is JSON and includes: { kind, requestId, draft, selectedNodeId, missingRequired, tool }.
- Keep the draft title/summary/nodes/edges structure unchanged unless explicitly requested.
- Update ONLY the selected node's properties with any user-provided values from the conversation.
- Use tool.inputSchema to understand field intent, but do not invent values.
- If required fields are missing, still return the draft via proposeWorkflow (only safe property fills), and ask targeted questions ONLY for the missingRequired keys.

IMPORTANT:
- You MUST call the proposeWorkflow tool with a BlueprintDraft object.
</instructions>

<hitl_protocol>
- If the draft references RESTRICTED tools, the UI may require explicit approval before applying.
- Ask concise questions to unblock configuration; do not ask for unnecessary details.
</hitl_protocol>

<reference_example>
If you need the user to supply required fields, ask only for those missing keys and suggest example values.
</reference_example>
`.trim();
}

export function buildBlueprintSummarizerPrompt(): string {
  return `
<system_role>
You are the AI Architect. You already created or updated a draft workflow blueprint in a tool call.
</system_role>

<instructions>
If the conversation includes a <workbench_node_refinement> JSON payload:
- Provide a 1-2 sentence summary of what you updated (or that no changes were applied yet).
- Ask only targeted questions for missingRequired fields.
- Do not ask general workflow questions unrelated to the selected node.

Otherwise (initial drafting):
Respond with:
1) A short summary of what you generated (title + 1-3 bullets of the flow).
2) The most important assumptions you made (if any).
3) 2-4 concrete questions that will help refine the workflow (inputs, schedule/trigger, destinations, error-handling, approvals).

Never return an empty response.
</instructions>
`.trim();
}
