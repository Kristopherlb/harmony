export type ChatIntent = "capability_discovery" | "workflow_generation" | "default";

export function classifyChatIntent(messageText: string): ChatIntent {
  const text = (messageText ?? "").toLowerCase().trim();
  if (!text) return "default";

  const asksForSecurityCapabilities =
    /\bwhat\b.*\b(security|auth|vulnerability|scanner)\b.*\b(tools|capabilities|integrations)\b/.test(text) &&
    /\b(available|have|supported|offer)\b/.test(text);

  const hasDiscoverySignal =
    /\b(what can you do|what tools|list tools|show tools|tool catalog|available tools|available capabilities|capabilities are available|what integrations|available integrations|which tools)\b/.test(
      text
    ) ||
    /\b(list|show)\b.*\b(capabilities|integrations|tools)\b/.test(text) ||
    asksForSecurityCapabilities;

  const hasGenerationSignal =
    /\b(create|generate|build|draft|workflow|refine|modify|add step|remove step|rename step|change step)\b/.test(text) ||
    /\b(implement|design)\b.*\b(workflow|automation|runbook)\b/.test(text);

  if (hasGenerationSignal) return "workflow_generation";
  if (hasDiscoverySignal) return "capability_discovery";
  return "default";
}
