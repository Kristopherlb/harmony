// server/security/adapters/security-repository-adapter.ts
// Adapter: Adapts ISecurityRepository to SecurityRepositoryPort

import type { ISecurityRepository } from "../../storage";
import type { SecurityRepositoryPort } from "../application/ports";

export class SecurityRepositoryAdapter implements SecurityRepositoryPort {
  constructor(private repository: ISecurityRepository) {}

  async getFindings(options?: {
    tool?: any;
    severity?: "critical" | "high" | "medium" | "low";
    status?: "open" | "resolved" | "ignored";
    page?: number;
    pageSize?: number;
  }) {
    return this.repository.getFindings(options);
  }

  async getSecuritySummary() {
    return this.repository.getSecuritySummary();
  }

  async createFinding(finding: any) {
    return this.repository.createFinding(finding);
  }

  async resolveFinding(id: string) {
    return this.repository.resolveFinding(id);
  }

  async getFindingById(id: string) {
    // If repository doesn't have this method, we can get it from getFindings
    const { findings } = await this.repository.getFindings({ pageSize: 10000 });
    return findings.find(f => f.id === id);
  }
}
