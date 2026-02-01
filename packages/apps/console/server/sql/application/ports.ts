// server/sql/application/ports.ts
// Application ports for SQL context

import type { QueryTemplate, QueryExecutionRequest, UserRole } from "@shared/schema";

export interface QueryTemplateRepositoryPort {
  getTemplates(role: UserRole): Promise<QueryTemplate[]>;
  getTemplateById(id: string): Promise<QueryTemplate | undefined>;
}

export interface SqlRunnerPort {
  executeQuery(
    request: QueryExecutionRequest,
    userId: string,
    username: string,
    role: UserRole
  ): Promise<{
    id: string;
    templateId: string;
    templateName: string;
    executedBy: string;
    executedByUsername: string;
    executedAt: string;
    rows: unknown[];
    rowCount: number;
    executionTimeMs: number;
  }>;
}
