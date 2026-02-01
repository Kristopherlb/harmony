// server/sql/application/execute-query.ts
// Use case: Execute a parameterized SQL query

import type { QueryExecutionRequest, UserRole } from "@shared/schema";
import type { QueryTemplateRepositoryPort, SqlRunnerPort } from "./ports";

export interface ExecuteQueryRequest {
  request: QueryExecutionRequest;
  userId: string;
  username: string;
  role: UserRole;
}

export interface ExecuteQueryResponse {
  id: string;
  templateId: string;
  templateName: string;
  executedBy: string;
  executedByUsername: string;
  executedAt: string;
  rows: unknown[];
  rowCount: number;
  executionTimeMs: number;
}

export class ExecuteQuery {
  constructor(
    private queryTemplateRepository: QueryTemplateRepositoryPort,
    private sqlRunner: SqlRunnerPort
  ) {}

  async execute(useCaseRequest: ExecuteQueryRequest): Promise<ExecuteQueryResponse> {
    const template = await this.queryTemplateRepository.getTemplateById(useCaseRequest.request.templateId);
    
    if (!template) {
      throw new Error("Query template not found");
    }

    if (!template.requiredRoles.includes(useCaseRequest.role)) {
      throw new Error("Insufficient permissions to execute this query");
    }

    return this.sqlRunner.executeQuery(
      useCaseRequest.request,
      useCaseRequest.userId,
      useCaseRequest.username,
      useCaseRequest.role
    );
  }
}
