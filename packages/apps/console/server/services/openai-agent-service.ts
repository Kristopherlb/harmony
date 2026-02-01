import { convertToModelMessages, createUIMessageStream, streamText, tool, type UIMessage } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import type { McpTool } from "@golden/mcp-server";
import type { ToolCatalogTool } from "../agent/services/harmony-mcp-tool-service";

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
      return `- ${t.name}${cls}: ${t.description}${schemaHint}`;
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
  async generateBlueprint(input: { messages: any[]; tools?: Array<McpTool & Partial<ToolCatalogTool>> }) {
    const toolsList = input.tools ?? [];
    const toolsSummary = toolsList.length > 0 ? summarizeToolsForPrompt(toolsList, 80) : "- (no tools available)";

    const blueprintPlanningPrompt = buildBlueprintPlanningPrompt({ toolsSummary });
    const summarizerPrompt = buildBlueprintSummarizerPrompt();

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        writer.write({ type: "start" });

        try {
          const uiMessages = normalizeIncomingMessages(input.messages);
          const modelMessages = await convertToModelMessages(uiMessages);

          // Step 1: force a tool call so the UI always receives a structured draft.
          const planning = streamText({
            model: openai(process.env.AI_MODEL_NAME || "gpt-4o"),
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
          });

          writer.merge(planning.toUIMessageStream({ sendFinish: false }));

          // Step 2: produce a human-readable summary + refinement questions.
          const planningMessages = (await planning.response).messages;

          const summary = streamText({
            model: openai(process.env.AI_MODEL_NAME || "gpt-4o"),
            system: summarizerPrompt,
            messages: [...modelMessages, ...planningMessages],
          });

          writer.merge(summary.toUIMessageStream({ sendStart: false }));
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
