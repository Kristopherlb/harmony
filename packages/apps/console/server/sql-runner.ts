import { v4 as uuidv4 } from "uuid";
import type {
  QueryTemplate,
  QueryExecutionResult,
  QueryExecutionRequest,
  UserRole,
  Event,
} from "@shared/schema";
import { actionRepository } from "./action-repository";

export interface ISqlRunner {
  executeQuery(
    request: QueryExecutionRequest,
    userId: string,
    username: string,
    role: UserRole
  ): Promise<QueryExecutionResult>;

  getTemplates(role: UserRole): Promise<QueryTemplate[]>;
}

const MOCK_USER_DATA = [
  { id: "U001", username: "alice", email: "alice@company.com", created_at: "2024-01-15", last_login: "2026-01-21" },
  { id: "U002", username: "bob", email: "bob@company.com", created_at: "2024-02-20", last_login: "2026-01-20" },
  { id: "U003", username: "charlie", email: "charlie@company.com", created_at: "2024-03-10", last_login: "2026-01-19" },
  { id: "U004", username: "diana", email: "diana@company.com", created_at: "2024-04-05", last_login: "2026-01-21" },
];

export class SafeSqlRunner implements ISqlRunner {
  private auditCallback?: (event: Omit<Event, "id">) => Promise<void>;

  constructor(auditCallback?: (event: Omit<Event, "id">) => Promise<void>) {
    this.auditCallback = auditCallback;
  }

  async executeQuery(
    request: QueryExecutionRequest,
    userId: string,
    username: string,
    role: UserRole
  ): Promise<QueryExecutionResult> {
    const startTime = Date.now();

    const template = await actionRepository.getQueryTemplateById(request.templateId);
    if (!template) {
      throw new Error(`Query template not found: ${request.templateId}`);
    }

    if (!template.requiredRoles.includes(role)) {
      throw new Error(`Insufficient permissions to execute this query`);
    }

    this.validateParams(template, request.params);

    const result = this.simulateQueryExecution(template, request.params);

    const executionResult: QueryExecutionResult = {
      id: uuidv4(),
      templateId: template.id,
      templateName: template.name,
      executedBy: userId,
      executedByUsername: username,
      executedAt: new Date().toISOString(),
      rowCount: result.rows.length,
      columns: result.columns,
      rows: result.rows,
      executionTimeMs: Date.now() - startTime,
    };

    await this.logAuditEvent(executionResult, template, request.params);

    return executionResult;
  }

  async getTemplates(role: UserRole): Promise<QueryTemplate[]> {
    const allTemplates = await actionRepository.getQueryTemplates();
    return allTemplates.filter((t) => t.requiredRoles.includes(role));
  }

  private validateParams(template: QueryTemplate, params: Record<string, unknown>): void {
    for (const param of template.params) {
      if (param.required && !(param.name in params)) {
        throw new Error(`Missing required parameter: ${param.name}`);
      }

      const value = params[param.name];
      if (value !== undefined && value !== null) {
        if (param.type === "email" && typeof value === "string" && !value.includes("@")) {
          throw new Error(`Parameter ${param.name} must be a valid email`);
        }
        if (param.type === "number" && typeof value !== "number" && isNaN(Number(value))) {
          throw new Error(`Parameter ${param.name} must be a number`);
        }

        if (typeof value === "string") {
          const sanitized = this.sanitizeInput(value);
          if (sanitized !== value) {
            throw new Error(`Parameter ${param.name} contains invalid characters`);
          }
        }
      }
    }
  }

  private sanitizeInput(input: string): string {
    const dangerous = /[;'"\\]/g;
    return input.replace(dangerous, "");
  }

  private simulateQueryExecution(
    template: QueryTemplate,
    params: Record<string, unknown>
  ): { columns: string[]; rows: Record<string, unknown>[] } {
    switch (template.id) {
      case "query-user-by-email": {
        const email = params.email as string;
        const user = MOCK_USER_DATA.find((u) => u.email === email);
        return {
          columns: ["id", "username", "email", "created_at", "last_login"],
          rows: user ? [user] : [],
        };
      }

      case "query-user-by-id": {
        const userId = params.userId as string;
        const user = MOCK_USER_DATA.find((u) => u.id === userId);
        return {
          columns: ["id", "username", "email", "created_at", "last_login"],
          rows: user ? [user] : [],
        };
      }

      case "count-events-by-source": {
        return {
          columns: ["source", "count"],
          rows: [
            { source: "slack", count: 42 },
            { source: "jira", count: 38 },
            { source: "gitlab", count: 67 },
            { source: "bitbucket", count: 29 },
            { source: "pagerduty", count: 15 },
          ],
        };
      }

      case "find-active-blockers": {
        const limit = (params.limit as number) || 50;
        const blockers = [
          { id: "b1", message: "Database connection pool exhausted", severity: "critical", username: "bob", timestamp: "2026-01-21T10:00:00Z", age_hours: 8.5 },
          { id: "b2", message: "Payment gateway returning 503 errors", severity: "high", username: "charlie", timestamp: "2026-01-20T14:00:00Z", age_hours: 28.5 },
        ];
        return {
          columns: ["id", "message", "severity", "username", "timestamp", "age_hours"],
          rows: blockers.slice(0, limit),
        };
      }

      default:
        return { columns: [], rows: [] };
    }
  }

  private async logAuditEvent(
    result: QueryExecutionResult,
    template: QueryTemplate,
    params: Record<string, unknown>
  ): Promise<void> {
    if (!this.auditCallback) return;

    const sanitizedParams = Object.fromEntries(
      Object.entries(params).map(([k, v]) => [
        k,
        typeof v === "string" && v.includes("@") ? v.replace(/(.{2}).*(@.*)/, "$1***$2") : v,
      ])
    );

    await this.auditCallback({
      timestamp: new Date().toISOString(),
      source: "jira",
      type: "log",
      payload: {
        queryType: "sql_runner",
        templateId: template.id,
        templateName: template.name,
        params: sanitizedParams,
        rowCount: result.rowCount,
        executionTimeMs: result.executionTimeMs,
      },
      severity: "low",
      userId: result.executedBy,
      username: result.executedByUsername,
      message: `SQL Query Executed: ${template.name} (${result.rowCount} rows, ${result.executionTimeMs}ms)`,
      resolved: true,
      resolvedAt: new Date().toISOString(),
      contextType: "general",
      serviceTags: [],
    });
  }
}

export const sqlRunner = new SafeSqlRunner();
