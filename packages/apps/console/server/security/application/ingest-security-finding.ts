// server/security/application/ingest-security-finding.ts
// Use case: Ingest security finding from webhook

import type { SecurityTool } from "@shared/schema";
import type { SecurityRepositoryPort, SecurityAdapterPort } from "./ports";

export interface IngestSecurityFindingRequest {
  tool: SecurityTool;
  payload: unknown;
}

export interface IngestSecurityFindingResponse {
  findingId: string;
  success: boolean;
  error?: string;
}

export class IngestSecurityFinding {
  constructor(
    private securityAdapter: SecurityAdapterPort,
    private securityRepository: SecurityRepositoryPort
  ) {}

  async execute(request: IngestSecurityFindingRequest): Promise<IngestSecurityFindingResponse> {
    const finding = this.securityAdapter.transformToFinding(request.payload);

    if (!finding) {
      return {
        findingId: "",
        success: false,
        error: "Could not transform payload to finding",
      };
    }

    const createdFinding = await this.securityRepository.createFinding({
      severity: finding.severity as any,
      tool: request.tool,
      cve: finding.title.includes("CVE") ? finding.title : undefined,
      asset: finding.asset,
      status: finding.status as any,
      title: finding.title,
      description: finding.title,
      detectedAt: finding.detectedAt,
    });

    return {
      findingId: createdFinding.id,
      success: true,
    };
  }
}
