// server/sql/http/sql-router.ts
// HTTP router for SQL context - parse/validate → use case → map response

import type { Request, Response } from "express";
import { Router as createRouter, type Router } from "express";
import { QueryExecutionRequestSchema, type UserRole } from "@shared/schema";
import { GetQueryTemplates } from "../application/get-query-templates";
import { ExecuteQuery } from "../application/execute-query";
import type { QueryTemplateRepositoryPort, SqlRunnerPort } from "../application/ports";

export interface SqlRouterDeps {
  queryTemplateRepository: QueryTemplateRepositoryPort;
  sqlRunner: SqlRunnerPort;
}

function getCurrentUser(req: Request): { userId: string; username: string; role: UserRole } {
  return {
    userId: (req.headers["x-user-id"] as string) || "demo-user",
    username: (req.headers["x-username"] as string) || "demo",
    role: (req.headers["x-user-role"] as UserRole) || "sre",
  };
}

export function createSqlRouter(deps: SqlRouterDeps): Router {
  const router = createRouter();

  const getQueryTemplates = new GetQueryTemplates(deps.queryTemplateRepository);
  const executeQuery = new ExecuteQuery(deps.queryTemplateRepository, deps.sqlRunner);

  // GET /api/sql/templates
  router.get("/templates", async (req: Request, res: Response) => {
    try {
      const { role } = getCurrentUser(req);
      const result = await getQueryTemplates.execute({ role });
      return res.json(result);
    } catch (error) {
      console.error("Error fetching query templates:", error);
      return res.status(500).json({ error: "Failed to fetch query templates" });
    }
  });

  // POST /api/sql/execute
  router.post("/execute", async (req: Request, res: Response) => {
    try {
      const { userId, username, role } = getCurrentUser(req);

      const parseResult = QueryExecutionRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: "Invalid query request",
          details: parseResult.error.flatten(),
        });
      }

      const result = await executeQuery.execute({
        request: parseResult.data,
        userId,
        username,
        role,
      });

      return res.json(result);
    } catch (error) {
      console.error("Error executing query:", error);
      if (error instanceof Error && (error.message.includes("not found") || error.message.includes("permissions"))) {
        return res.status(400).json({
          error: "Failed to execute query",
          details: error.message,
        });
      }
      return res.status(500).json({
        error: "Failed to execute query",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  return router;
}
