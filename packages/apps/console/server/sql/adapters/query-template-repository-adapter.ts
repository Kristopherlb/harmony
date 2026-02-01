// server/sql/adapters/query-template-repository-adapter.ts
// Adapter: Adapts IActionRepository to QueryTemplateRepositoryPort

import type { IActionRepository } from "../../action-repository";
import type { QueryTemplateRepositoryPort } from "../application/ports";
import type { UserRole } from "@shared/schema";

export class QueryTemplateRepositoryAdapter implements QueryTemplateRepositoryPort {
  constructor(private actionRepository: IActionRepository) {}

  async getTemplates(role: UserRole) {
    const allTemplates = await this.actionRepository.getQueryTemplates();
    return allTemplates.filter(t => t.requiredRoles.includes(role));
  }

  async getTemplateById(id: string) {
    return this.actionRepository.getQueryTemplateById(id);
  }
}
