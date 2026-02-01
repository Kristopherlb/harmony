// server/sql/application/get-query-templates.ts
// Use case: Get query templates available to user role

import type { UserRole } from "@shared/schema";
import type { QueryTemplateRepositoryPort } from "./ports";

export interface GetQueryTemplatesRequest {
  role: UserRole;
}

export interface GetQueryTemplatesResponse {
  templates: Array<{
    id: string;
    name: string;
    description: string;
    templateSql: string;
    type: "read" | "aggregate";
    params: Array<{
      name: string;
      type: string;
      label: string;
      required: boolean;
      placeholder?: string;
      options?: string[];
      validation?: string;
    }>;
    requiredRoles: string[];
  }>;
}

export class GetQueryTemplates {
  constructor(private queryTemplateRepository: QueryTemplateRepositoryPort) {}

  async execute(request: GetQueryTemplatesRequest): Promise<GetQueryTemplatesResponse> {
    const templates = await this.queryTemplateRepository.getTemplates(request.role);
    return { templates };
  }
}
