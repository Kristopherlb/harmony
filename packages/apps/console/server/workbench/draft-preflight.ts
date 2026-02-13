/**
 * packages/apps/console/server/workbench/draft-preflight.ts
 * Server-side preflight for running a Workbench draft.
 */
import type { ToolCatalogTool } from "../agent/services/harmony-mcp-tool-service";
import { classifyWorkbenchToolApprovalTier } from "./approval-policy";

type BlueprintDraft = {
  title: string;
  summary: string;
  nodes: Array<{ id: string; label: string; type: string; properties?: Record<string, unknown> }>;
  edges: Array<{ source: string; target: string; label?: string }>;
};

const PRIMITIVE_NODE_TYPES = new Set(["start", "sleep", "log", "condition"]);

export type DraftPreflightFinding =
  | { kind: "unknown_tool"; nodeId: string; toolId: string }
  | { kind: "missing_required"; nodeId: string; toolId: string; field: string }
  | { kind: "restricted_requires_approval"; nodeId: string; toolId: string };

export type DraftPreflightWarning =
  | { kind: "critical_requires_peer_approval"; nodeId: string; toolId: string };

export type DraftPreflightReport = {
  ok: boolean;
  findings: DraftPreflightFinding[];
  warnings: DraftPreflightWarning[];
};

function isFilledValue(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim().length > 0;
  return true;
}

function schemaRequiredKeys(schema: unknown): string[] {
  if (!schema || typeof schema !== "object") return [];
  const req = (schema as any).required;
  if (!Array.isArray(req)) return [];
  return req.filter((x) => typeof x === "string") as string[];
}

function findToolById(tools: ToolCatalogTool[], toolId: string): ToolCatalogTool | null {
  return tools.find((t) => t.name === toolId) ?? null;
}

export function preflightDraft(input: {
  draft: BlueprintDraft;
  tools: ToolCatalogTool[];
  policy?: { approvedRestricted?: boolean };
}): DraftPreflightReport {
  const approvedRestricted = Boolean(input.policy?.approvedRestricted);
  const findings: DraftPreflightFinding[] = [];
  const warnings: DraftPreflightWarning[] = [];

  for (const node of input.draft.nodes ?? []) {
    if (PRIMITIVE_NODE_TYPES.has(node.type)) continue;

    const tool = findToolById(input.tools, node.type);
    if (!tool) {
      findings.push({ kind: "unknown_tool", nodeId: node.id, toolId: node.type });
      continue;
    }

    const tier = classifyWorkbenchToolApprovalTier({
      toolId: tool.name,
      dataClassification: tool.dataClassification,
    });
    if (tier === "restricted" && !approvedRestricted) {
      findings.push({ kind: "restricted_requires_approval", nodeId: node.id, toolId: tool.name });
    }
    if (tier === "critical") {
      warnings.push({ kind: "critical_requires_peer_approval", nodeId: node.id, toolId: tool.name });
    }

    const required = schemaRequiredKeys(tool.inputSchema);
    const props =
      node.properties && typeof node.properties === "object" && !Array.isArray(node.properties)
        ? node.properties
        : {};
    for (const key of required) {
      if (!isFilledValue((props as any)[key])) {
        findings.push({ kind: "missing_required", nodeId: node.id, toolId: tool.name, field: key });
      }
    }
  }

  return { ok: findings.length === 0, findings, warnings };
}

