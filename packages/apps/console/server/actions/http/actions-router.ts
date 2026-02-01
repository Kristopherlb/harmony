// server/actions/http/actions-router.ts
// HTTP router for actions context - parse/validate → use case → map response

import type { Express, Request, Response } from "express";
import type { Router } from "express";
import { Router as createRouter } from "express";
import {
  ExecuteActionRequestSchema,
  ApprovalRequestSchema,
  type UserRole,
} from "@shared/schema";
import { GetActionCatalog } from "../application/get-action-catalog";
import { GetActionById } from "../application/get-action-by-id";
import { ExecuteAction } from "../application/execute-action";
import { GetWorkflowStatus } from "../application/get-workflow-status";
import { GetPendingApprovals } from "../application/get-pending-approvals";
import { ApproveOrRejectAction } from "../application/approve-or-reject-action";
import { GetExecutions } from "../application/get-executions";
import { toSharedAction, toSharedWorkflowExecution, toDomainExecuteActionRequest } from "../domain/mappers";
import type {
  ActionRepositoryPort,
  WorkflowEnginePort,
  PermissionServicePort,
  EventIngestionPort,
} from "../application/ports";

export interface ActionsRouterDeps {
  actionRepository: ActionRepositoryPort;
  workflowEngine: WorkflowEnginePort;
  permissionService: PermissionServicePort;
  eventIngestion: EventIngestionPort;
}

function getCurrentUser(req: Request): { userId: string; username: string; role: UserRole } {
  return {
    userId: (req.headers["x-user-id"] as string) || "demo-user",
    username: (req.headers["x-username"] as string) || "demo",
    role: (req.headers["x-user-role"] as UserRole) || "sre",
  };
}

export function createActionsRouter(deps: ActionsRouterDeps): Router {
  const router = createRouter();

  const getActionCatalog = new GetActionCatalog(deps.actionRepository, deps.permissionService);
  const getActionById = new GetActionById(deps.actionRepository);
  const executeAction = new ExecuteAction(
    deps.actionRepository,
    deps.workflowEngine,
    deps.permissionService,
    deps.eventIngestion
  );
  const getWorkflowStatus = new GetWorkflowStatus(deps.workflowEngine);
  const getPendingApprovals = new GetPendingApprovals(deps.actionRepository, deps.permissionService);
  const approveOrRejectAction = new ApproveOrRejectAction(
    deps.actionRepository,
    deps.workflowEngine,
    deps.permissionService,
    deps.eventIngestion
  );
  const getExecutions = new GetExecutions(deps.actionRepository);

  // Get action catalog
  router.get("/catalog", async (req: Request, res: Response) => {
    try {
      const { userId, role } = getCurrentUser(req);
      const result = await getActionCatalog.execute({ userId, role });
      // Map domain actions to shared/contract format
      return res.json({
        actions: result.actions.map(toSharedAction),
        categories: result.categories,
      });
    } catch (error) {
      console.error("Error fetching action catalog:", error);
      return res.status(500).json({ error: "Failed to fetch action catalog" });
    }
  });

  // Get single action
  router.get("/:actionId", async (req: Request, res: Response) => {
    try {
      const actionId = Array.isArray(req.params.actionId) ? req.params.actionId[0] : req.params.actionId;
      const action = await getActionById.execute({ actionId });

      if (!action) {
        return res.status(404).json({ error: "Action not found" });
      }

      // Map domain action to shared/contract format
      return res.json(toSharedAction(action));
    } catch (error) {
      console.error("Error fetching action:", error);
      return res.status(500).json({ error: "Failed to fetch action" });
    }
  });

  // Execute an action
  router.post("/execute", async (req: Request, res: Response) => {
    try {
      const { userId, username, role } = getCurrentUser(req);

      const parseResult = ExecuteActionRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: "Invalid execution request",
          details: parseResult.error.flatten(),
        });
      }

      // Convert shared request to domain request
      const domainRequest = toDomainExecuteActionRequest(parseResult.data);
      const result = await executeAction.execute({
        request: domainRequest,
        userId,
        username,
        role,
      });

      // Map domain execution to shared/contract format
      return res.json({
        execution: toSharedWorkflowExecution(result.execution),
        requiresApproval: result.requiresApproval,
        message: result.message,
      });
    } catch (error) {
      console.error("Error executing action:", error);
      if (error instanceof Error && error.message === "Action not found") {
        return res.status(404).json({ error: error.message });
      }
      if (error instanceof Error && error.message === "Insufficient permissions") {
        return res.status(403).json({ error: error.message });
      }
      return res.status(500).json({
        error: "Failed to execute action",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Get workflow status
  router.get("/executions/:runId/status", async (req: Request, res: Response) => {
    try {
      const runId = Array.isArray(req.params.runId) ? req.params.runId[0] : req.params.runId;
      const status = await getWorkflowStatus.execute({ runId });

      if (!status) {
        return res.status(404).json({ error: "Execution not found" });
      }

      return res.json(status);
    } catch (error) {
      console.error("Error fetching workflow status:", error);
      return res.status(500).json({ error: "Failed to fetch workflow status" });
    }
  });

  // Get pending approvals
  router.get("/approvals/pending", async (req: Request, res: Response) => {
    try {
      const { role } = getCurrentUser(req);
      const result = await getPendingApprovals.execute({ role });
      // Map domain executions to shared/contract format
      return res.json({
        executions: result.executions.map(toSharedWorkflowExecution),
        total: result.total,
      });
    } catch (error) {
      console.error("Error fetching pending approvals:", error);
      if (error instanceof Error && error.message.includes("Insufficient permissions")) {
        return res.status(403).json({ error: error.message });
      }
      return res.status(500).json({ error: "Failed to fetch pending approvals" });
    }
  });

  // Approve/reject an execution
  router.post("/approvals", async (req: Request, res: Response) => {
    try {
      const { userId, username, role } = getCurrentUser(req);

      const parseResult = ApprovalRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: "Invalid approval request",
          details: parseResult.error.flatten(),
        });
      }

      const result = await approveOrRejectAction.execute({
        executionId: parseResult.data.executionId,
        action: parseResult.data.action,
        comment: parseResult.data.comment,
        userId,
        username,
        role,
      });

      return res.json(result);
    } catch (error) {
      console.error("Error processing approval:", error);
      if (error instanceof Error) {
        if (error.message.includes("Insufficient permissions")) {
          return res.status(403).json({ error: error.message });
        }
        if (error.message.includes("not found") || error.message.includes("not pending")) {
          return res.status(400).json({ error: error.message });
        }
      }
      return res.status(500).json({ error: "Failed to process approval" });
    }
  });

  // Get recent executions
  router.get("/executions", async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const result = await getExecutions.execute({ limit });
      // Map domain executions to shared/contract format
      return res.json({
        executions: result.executions.map(toSharedWorkflowExecution),
        total: result.total,
      });
    } catch (error) {
      console.error("Error fetching executions:", error);
      return res.status(500).json({ error: "Failed to fetch executions" });
    }
  });

  return router;
}
