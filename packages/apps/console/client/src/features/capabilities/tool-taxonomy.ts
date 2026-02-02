/**
 * packages/apps/console/client/src/features/capabilities/tool-taxonomy.ts
 * Shared taxonomy rules for capability/tool discovery.
 */

export function deriveDomainParts(toolId: string): { domain: string; subdomain: string } {
  const parts = toolId.split(".").filter((p) => p.trim().length > 0);
  if (parts.length === 0) return { domain: "other", subdomain: "" };

  // Convention: OCS capabilities use `golden.<domain>.<subdomain...>`.
  if (parts[0] === "golden") {
    // Handle legacy/demo IDs like `golden.echo`.
    if (parts.length === 2) return { domain: "demo", subdomain: parts[1] };
    if (parts.length >= 3) return { domain: parts[1], subdomain: parts.slice(2).join(".") };
    return { domain: "other", subdomain: parts.slice(1).join(".") };
  }

  // Blueprints and other tool families use their own prefix, e.g. `workflows.echo`.
  return { domain: parts[0], subdomain: parts.slice(1).join(".") };
}

export type ToolCollectionId =
  | "security_scanning"
  | "progressive_delivery";

export function getCollectionsForToolId(input: {
  toolId: string;
  tags?: string[];
  domain?: string;
}): ToolCollectionId[] {
  const derived = deriveDomainParts(input.toolId);
  const domain = (input.domain ?? derived.domain).toLowerCase();
  const tagSet = new Set((input.tags ?? []).map((t) => t.toLowerCase()));

  const out: ToolCollectionId[] = [];

  const isSecurity = domain === "security" || tagSet.has("security") || tagSet.has("guardian");
  if (isSecurity) out.push("security_scanning");

  const isProgressiveDelivery =
    domain === "traffic" ||
    domain === "flags" ||
    tagSet.has("traffic") ||
    tagSet.has("feature-flags") ||
    tagSet.has("service-mesh");
  if (isProgressiveDelivery) out.push("progressive_delivery");

  return Array.from(new Set(out));
}

