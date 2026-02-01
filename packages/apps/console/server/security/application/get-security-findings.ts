// server/security/application/get-security-findings.ts
// Use case: Get security findings with filters

import type { SecurityTool } from "@shared/schema";
import type { SecurityRepositoryPort } from "./ports";

export interface GetSecurityFindingsRequest {
  tool?: SecurityTool;
  severity?: "critical" | "high" | "medium" | "low";
  status?: "open" | "resolved" | "ignored";
  page?: number;
  pageSize?: number;
}

export interface GetSecurityFindingsResponse {
  findings: Array<{
    id: string;
    severity: string;
    tool: string;
    cve?: string;
    asset: string;
    status: string;
    title: string;
    description?: string;
    detectedAt: string;
    resolvedAt?: string;
    externalLink?: string;
  }>;
  total: number;
  page: number;
  pageSize: number;
}

export class GetSecurityFindings {
  constructor(private securityRepository: SecurityRepositoryPort) {}

  async execute(request: GetSecurityFindingsRequest): Promise<GetSecurityFindingsResponse> {
    const page = request.page ?? 1;
    const pageSize = Math.min(request.pageSize ?? 50, 100);

    const result = await this.securityRepository.getFindings({
      tool: request.tool,
      severity: request.severity,
      status: request.status,
      page,
      pageSize,
    });

    return {
      findings: result.findings,
      total: result.total,
      page,
      pageSize,
    };
  }
}
