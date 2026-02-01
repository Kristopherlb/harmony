import { v4 as uuidv4 } from "uuid";
import type { SecurityFinding, SecurityTool, SecuritySeverity, InsertSecurityFinding } from "@shared/schema";

export interface ISecurityAdapter {
  readonly tool: SecurityTool;
  transformToFinding(payload: unknown): InsertSecurityFinding | null;
}

export interface WizPayload {
  id?: string;
  severity?: string;
  vulnerabilityName?: string;
  cve?: string;
  resource?: {
    name?: string;
    type?: string;
  };
  status?: string;
  description?: string;
  detectedAt?: string;
  url?: string;
}

export interface AWSInspectorPayload {
  findingArn?: string;
  severity?: string;
  title?: string;
  vulnerabilityId?: string;
  resources?: Array<{ id?: string; type?: string }>;
  status?: string;
  description?: string;
  firstObservedAt?: string;
  inspectorScoreDetails?: { adjustedCvss?: { score?: number } };
}

export interface ArtifactoryXrayPayload {
  id?: string;
  severity?: string;
  summary?: string;
  cves?: Array<{ cve?: string }>;
  impacted_artifacts?: Array<{ name?: string; path?: string }>;
  status?: string;
  description?: string;
  created?: string;
  issue_id?: string;
}

function normalizeSeverity(severity: string | undefined): SecuritySeverity {
  if (!severity) return "medium";
  const lower = severity.toLowerCase();
  if (lower === "critical" || lower === "urgent") return "critical";
  if (lower === "high" || lower === "important") return "high";
  if (lower === "medium" || lower === "moderate") return "medium";
  return "low";
}

function normalizeStatus(status: string | undefined): "open" | "resolved" | "ignored" {
  if (!status) return "open";
  const lower = status.toLowerCase();
  if (lower === "resolved" || lower === "fixed" || lower === "closed" || lower === "suppressed") return "resolved";
  if (lower === "ignored" || lower === "accepted" || lower === "risk_accepted") return "ignored";
  return "open";
}

export class WizAdapter implements ISecurityAdapter {
  readonly tool: SecurityTool = "wiz";

  transformToFinding(payload: unknown): InsertSecurityFinding | null {
    const p = payload as WizPayload;
    if (!p || typeof p !== "object") return null;

    const asset = p.resource?.name || "Unknown Asset";
    const title = p.vulnerabilityName || "Wiz Finding";

    return {
      severity: normalizeSeverity(p.severity),
      tool: this.tool,
      cve: p.cve,
      asset,
      status: normalizeStatus(p.status),
      title,
      description: p.description,
      detectedAt: p.detectedAt || new Date().toISOString(),
      externalLink: p.url,
    };
  }
}

export class AWSInspectorAdapter implements ISecurityAdapter {
  readonly tool: SecurityTool = "aws_inspector";

  transformToFinding(payload: unknown): InsertSecurityFinding | null {
    const p = payload as AWSInspectorPayload;
    if (!p || typeof p !== "object") return null;

    const asset = p.resources?.[0]?.id || "Unknown Resource";
    const title = p.title || "AWS Inspector Finding";

    return {
      severity: normalizeSeverity(p.severity),
      tool: this.tool,
      cve: p.vulnerabilityId,
      asset,
      status: normalizeStatus(p.status),
      title,
      description: p.description,
      detectedAt: p.firstObservedAt || new Date().toISOString(),
      externalLink: p.findingArn ? `https://console.aws.amazon.com/inspector2/home#/findings/details/${encodeURIComponent(p.findingArn)}` : undefined,
    };
  }
}

export class ArtifactoryXrayAdapter implements ISecurityAdapter {
  readonly tool: SecurityTool = "artifactory_xray";

  transformToFinding(payload: unknown): InsertSecurityFinding | null {
    const p = payload as ArtifactoryXrayPayload;
    if (!p || typeof p !== "object") return null;

    const artifact = p.impacted_artifacts?.[0];
    const asset = artifact?.path || artifact?.name || "Unknown Artifact";
    const title = p.summary || "Xray Security Issue";
    const cve = p.cves?.[0]?.cve;

    return {
      severity: normalizeSeverity(p.severity),
      tool: this.tool,
      cve,
      asset,
      status: normalizeStatus(p.status),
      title,
      description: p.description,
      detectedAt: p.created || new Date().toISOString(),
      externalLink: p.issue_id ? `https://jfrog.com/xray/issues/${p.issue_id}` : undefined,
    };
  }
}

export const securityAdapters: Record<SecurityTool, ISecurityAdapter> = {
  wiz: new WizAdapter(),
  aws_inspector: new AWSInspectorAdapter(),
  artifactory_xray: new ArtifactoryXrayAdapter(),
};

export function getSecurityAdapter(tool: SecurityTool): ISecurityAdapter {
  return securityAdapters[tool];
}

export function isValidSecurityTool(tool: string): tool is SecurityTool {
  return tool === "wiz" || tool === "aws_inspector" || tool === "artifactory_xray";
}
