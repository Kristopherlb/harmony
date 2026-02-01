// server/security/application/ports.ts
// Application ports for security context

import type { SecurityFinding, SecurityTool, InsertSecurityFinding } from "@shared/schema";

export interface SecurityRepositoryPort {
  getFindings(options?: {
    tool?: SecurityTool;
    severity?: "critical" | "high" | "medium" | "low";
    status?: "open" | "resolved" | "ignored";
    page?: number;
    pageSize?: number;
  }): Promise<{ findings: SecurityFinding[]; total: number }>;
  getSecuritySummary(): Promise<{
    totalOpen: number;
    bySeverity: Record<"low" | "medium" | "high" | "critical", number>;
    byTool: Record<"wiz" | "aws_inspector" | "artifactory_xray", number>;
  }>;
  createFinding(finding: InsertSecurityFinding): Promise<SecurityFinding>;
  resolveFinding(id: string): Promise<SecurityFinding | undefined>;
  getFindingById(id: string): Promise<SecurityFinding | undefined>;
}

export interface SecurityAdapterPort {
  transformToFinding(payload: unknown): {
    title: string;
    status: string;
    severity: string;
    tool: string;
    asset: string;
    detectedAt: string;
  } | null;
}
