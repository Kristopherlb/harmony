/**
 * packages/apps/console/server/workbench/approval-policy.ts
 * Workbench approval tiering (risk-tiered default).
 *
 * - standard: audit-only
 * - restricted: self-ack + audit
 * - critical: peer approval + audit (workflow pauses via waitForApproval)
 */

export type WorkbenchApprovalTier = "standard" | "restricted" | "critical";

const DEFAULT_CRITICAL_TOOL_IDS = new Set<string>([
  "golden.k8s.apply",
  "golden.commanders.kubectl",
  "golden.commanders.terraform-runner",
]);

function parseCsvEnvSet(name: string): Set<string> | null {
  const raw = (process.env[name] ?? "").trim();
  if (!raw) return null;
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return new Set(parts);
}

export function classifyWorkbenchToolApprovalTier(input: {
  toolId: string;
  dataClassification: string;
}): WorkbenchApprovalTier {
  if (input.dataClassification !== "RESTRICTED") return "standard";

  const override = parseCsvEnvSet("WORKBENCH_CRITICAL_TOOL_IDS");
  const criticalIds = override ?? DEFAULT_CRITICAL_TOOL_IDS;
  return criticalIds.has(input.toolId) ? "critical" : "restricted";
}

