import { isBlueprintDraft, type BlueprintDraft } from "@/features/workbench/types";

function safeJsonParse(value: string): unknown | null {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function getMessageText(message: any): string {
  // AI SDK UIMessage (v5+): parts[]
  if (Array.isArray(message?.parts)) {
    return message.parts
      .map((part: any) => (part?.type === "text" ? String(part.text ?? "") : ""))
      .join("");
  }

  // Legacy: content string
  if (typeof message?.content === "string") return message.content;
  return "";
}

function isSafeTemplateId(id: string): boolean {
  // Template IDs are repo-defined; keep parsing conservative to avoid accidental injection.
  return /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(id);
}

/**
 * Extract a suggested templateId marker from an assistant message.
 * Marker format: <templateId>some-template-id</templateId>
 */
export function getSuggestedTemplateIdFromMessage(message: any): string | null {
  const text = getMessageText(message);
  if (!text) return null;
  const match = text.match(/<templateId>([^<]+)<\/templateId>/i);
  const raw = match?.[1]?.trim() ?? "";
  if (!raw) return null;
  if (!isSafeTemplateId(raw)) return null;
  return raw;
}

export function coerceBlueprintDraft(value: unknown): BlueprintDraft | null {
  if (isBlueprintDraft(value)) return value;
  if (typeof value !== "object" || value === null) return null;

  const v = value as any;
  if (typeof v.title !== "string" || !Array.isArray(v.nodes) || !Array.isArray(v.edges)) {
    return null;
  }

  const nodes = v.nodes.map((node: any, idx: number) => {
    const rawProperties = node?.properties;
    const properties =
      typeof rawProperties === "string"
        ? (() => {
            const parsed = safeJsonParse(rawProperties);
            return parsed && typeof parsed === "object" ? parsed : {};
          })()
        : rawProperties && typeof rawProperties === "object"
          ? rawProperties
          : {};

    return {
      id: typeof node?.id === "string" ? node.id : `node-${idx + 1}`,
      label:
        typeof node?.label === "string"
          ? node.label
          : typeof node?.description === "string"
            ? node.description
            : `Step ${idx + 1}`,
      type:
        typeof node?.type === "string"
          ? node.type
          : idx === 0
            ? "trigger"
            : "action",
      description: typeof node?.description === "string" ? node.description : undefined,
      properties,
    };
  });

  const edges = v.edges.map((edge: any) => ({
    source: String(edge?.source ?? ""),
    target: String(edge?.target ?? ""),
    label: typeof edge?.label === "string" ? edge.label : undefined,
  }));

  if (edges.some((e: any) => !e.source || !e.target)) return null;

  const draft: BlueprintDraft = {
    title: v.title,
    summary: typeof v.summary === "string" ? v.summary : "",
    nodes,
    edges,
  };

  return isBlueprintDraft(draft) ? draft : null;
}

/** Extract explainStep tool output from an assistant message (Phase 4.2.3). */
export function getExplainStepFromMessage(message: any): { nodeId: string; explanation: string } | null {
  if (!message?.parts || !Array.isArray(message.parts)) return null;
  for (const part of message.parts as any[]) {
    if (part?.type === "tool-explainStep" && part?.state === "output-available" && part?.output) {
      const o = part.output as { nodeId?: string; explanation?: string };
      if (typeof o.nodeId === "string" && typeof o.explanation === "string") {
        return { nodeId: o.nodeId, explanation: o.explanation };
      }
    }
    if (part?.type === "dynamic-tool" && part?.toolName === "explainStep" && part?.state === "output-available" && part?.output) {
      const o = part.output as { nodeId?: string; explanation?: string };
      if (typeof o.nodeId === "string" && typeof o.explanation === "string") {
        return { nodeId: o.nodeId, explanation: o.explanation };
      }
    }
  }
  return null;
}

export function getDraftFromAssistantMessage(message: any): BlueprintDraft | null {
  // AI SDK v5+: tool parts live in message.parts with a type like "tool-proposeWorkflow"
  if (Array.isArray(message?.parts)) {
    for (const part of message.parts as any[]) {
      if (part?.type !== "tool-proposeWorkflow") continue;

      // Tool finished: output available.
      if (part?.state === "output-available") {
        return coerceBlueprintDraft(part.output);
      }
    }

    // Some transports surface tools as a generic dynamic-tool part.
    for (const part of message.parts as any[]) {
      if (part?.type !== "dynamic-tool") continue;
      if (part?.toolName !== "proposeWorkflow") continue;
      if (part?.state === "output-available") {
        return coerceBlueprintDraft(part.output);
      }
    }
  }

  // Legacy (some SDKs / custom adapters): toolInvocations w/ { toolName, result }
  const toolInvocation = message?.toolInvocations?.find?.(
    (tool: any) => tool?.toolName === "proposeWorkflow"
  );
  if (toolInvocation) {
    const maybeResult =
      "result" in toolInvocation ? toolInvocation.result : ("output" in toolInvocation ? toolInvocation.output : null);
    const coerced = coerceBlueprintDraft(maybeResult);
    if (coerced) return coerced;
  }

  // Back-compat: allow JSON text that contains the draft.
  const text = getMessageText(message).trim();
  if (text.length > 0) {
    const parsed = safeJsonParse(text);
    if (parsed) {
      const coerced = coerceBlueprintDraft(parsed);
      if (coerced) return coerced;
    }
  }

  return null;
}

