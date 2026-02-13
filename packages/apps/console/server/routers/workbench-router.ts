import type { Request, Response } from "express";
import { Router } from "express";
import { appendApprovalLog, isApprovalLogValidationError, listApprovalLog } from "../audit/approval-log";
import { getWorkbenchMetricsText, recordWorkbenchTelemetry } from "../observability/workbench-metrics";
import { getBudgetPolicy, getTotals, setBudgetPolicy } from "../services/llm-cost-tracker";
import {
  getRecommendationDiagnostics,
  recordRecipeFeedback,
  recordRecommendationOutcome,
} from "../services/golden-path-recipes";
import type { HarmonyMcpToolService } from "../agent/services/harmony-mcp-tool-service";
import { preflightDraft } from "../workbench/draft-preflight";
import { classifyWorkbenchToolApprovalTier } from "../workbench/approval-policy";
import { getTemporalClient } from "../services/temporal/temporal-client.js";
import * as coreWorkflow from "@golden/core/workflow";
import { unwrapCjsNamespace } from "../lib/cjs-interop";

type CreateSessionRequest = {
  provider: string;
  kind: string;
  mode: string;
};

type CreateSessionResponse = {
  sessionId: string;
  expiresAt: string;
  launchUrl?: string;
};

function safeUrlJoin(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

function readWorkbenchBaseUrl(): string {
  const v = (process.env.WORKBENCH_SERVER_URL ?? "").trim();
  if (v.length > 0) return v.replace(/\/+$/, "");
  return "http://127.0.0.1:8787";
}

const coreWorkflowPkg = unwrapCjsNamespace<typeof coreWorkflow>(coreWorkflow as any);

export function createWorkbenchRouter(deps?: { mcpToolService?: HarmonyMcpToolService }) {
  const router = Router();
  const mcpToolService = deps?.mcpToolService;

  router.get("/health", async (_req: any, res: any) => {
    const baseUrl = readWorkbenchBaseUrl();
    try {
      const url = `${baseUrl}/workbench/health`;
      const wbRes = await fetch(url, { method: "GET" });
      const text = await wbRes.text();
      return res.status(wbRes.status).send(text);
    } catch (error: any) {
      return res.status(502).json({
        error: "WORKBENCH_UNREACHABLE",
        target: baseUrl,
        details: String(error?.message ?? error),
      });
    }
  });

  router.post("/sessions", async (req: any, res: any) => {
    try {
      const input = (req.body ?? {}) as Partial<CreateSessionRequest>;
      if (!input.provider || !input.kind || !input.mode) {
        return res.status(400).json({ error: "INPUT_VALIDATION_FAILED" });
      }

      const origin = typeof req.headers.origin === "string" ? req.headers.origin : "";
      if (!origin) return res.status(400).json({ error: "MISSING_ORIGIN" });

      const baseUrl = readWorkbenchBaseUrl();
      const url = `${baseUrl}/workbench/sessions`;

      let wbRes: Response;
      try {
        wbRes = await fetch(url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin,
            ...(typeof req.headers["x-dev-user"] === "string" ? { "x-dev-user": req.headers["x-dev-user"] } : {}),
            ...(typeof req.headers["x-dev-roles"] === "string" ? { "x-dev-roles": req.headers["x-dev-roles"] } : {}),
          },
          body: JSON.stringify({
            provider: input.provider,
            kind: input.kind,
            mode: input.mode,
          }),
        });
      } catch (error: any) {
        return res.status(502).json({
          error: "WORKBENCH_UNREACHABLE",
          target: url,
          details: String(error?.message ?? error),
          hint: "Start workbench-server (pnpm nx serve workbench-server) or set WORKBENCH_SERVER_URL.",
        });
      }

      const text = await wbRes.text();
      if (!wbRes.ok) {
        return res.status(wbRes.status).json({
          error: "WORKBENCH_ERROR",
          target: url,
          details: text || wbRes.statusText,
        });
      }

      const parsed = JSON.parse(text) as CreateSessionResponse;
      // workbench-server only includes launchUrl when configured with WORKBENCH_PUBLIC_BASE_URL.
      // For local/dev UX, we derive a launch URL from the configured server URL so the Console can
      // reliably open the playground in a new tab.
      if (!parsed.launchUrl && input.mode === "launch") {
        parsed.launchUrl = safeUrlJoin(
          baseUrl,
          `/workbench/launch/${encodeURIComponent(String(input.kind))}?sessionId=${encodeURIComponent(
            parsed.sessionId
          )}&provider=${encodeURIComponent(String(input.provider))}`
        );
      }
      return res.status(200).json(parsed);
    } catch (error: any) {
      return res.status(500).json({ error: "INTERNAL_ERROR", details: String(error?.message ?? error) });
    }
  });

  // Phase 1: draft preflight (missing required fields, unknown tools, restricted gating)
  router.post("/drafts/preflight", async (req: Request, res: Response) => {
    if (!mcpToolService) {
      return res.status(500).json({ error: "MCP_TOOL_SERVICE_UNAVAILABLE" });
    }

    const body = (req.body ?? {}) as {
      draft?: unknown;
      approvedRestricted?: boolean;
    };
    const draft = body.draft as any;
    if (!draft || typeof draft !== "object") {
      return res.status(400).json({ error: "INPUT_VALIDATION_FAILED" });
    }

    const snapshot = mcpToolService.snapshot();
    const report = preflightDraft({
      draft,
      tools: snapshot.tools as any,
      policy: { approvedRestricted: Boolean(body.approvedRestricted) },
    });
    return res.status(200).json(report);
  });

  // Phase 1: run current draft as a single Temporal workflow.
  router.post("/drafts/run", async (req: Request, res: Response) => {
    if (!mcpToolService) {
      return res.status(500).json({ error: "MCP_TOOL_SERVICE_UNAVAILABLE" });
    }

    const body = (req.body ?? {}) as {
      draft?: unknown;
      approvedRestricted?: boolean;
      workflowId?: string;
    };
    const draft = body.draft as any;
    if (!draft || typeof draft !== "object") {
      return res.status(400).json({ error: "INPUT_VALIDATION_FAILED" });
    }

    const snapshot = mcpToolService.snapshot();
    const report = preflightDraft({
      draft,
      tools: snapshot.tools as any,
      policy: { approvedRestricted: Boolean(body.approvedRestricted) },
    });
    if (!report.ok) {
      return res.status(400).json({ error: "PREFLIGHT_FAILED", report });
    }

    try {
      const client = await getTemporalClient();
      const taskQueue = process.env.TEMPORAL_TASK_QUEUE || "golden-tools";
      const workflowId = body.workflowId || `workbench.draft-run-${Date.now()}`;
      const traceId = `trace-${workflowId}`;

      const securityContext = {
        initiatorId: "local-user",
        roles: ["local"],
        tokenRef: "local",
        traceId,
      };

      const goldenContext = {
        app_id: "console",
        environment: "local",
        initiator_id: securityContext.initiatorId,
        trace_id: traceId,
        cost_center: "local",
        data_classification: "INTERNAL",
      };

      const criticalNodeIds = (report.warnings ?? [])
        .filter((w: any) => w?.kind === "critical_requires_peer_approval" && typeof w?.nodeId === "string")
        .map((w: any) => w.nodeId);
      const approvalRolesEnv = (process.env.WORKBENCH_APPROVAL_REQUIRED_ROLES ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const notifySlackChannel = (process.env.WORKBENCH_APPROVAL_SLACK_CHANNEL ?? "").trim() || undefined;

      const handle = await (client as any).start("workbenchDraftRunWorkflow", {
        taskQueue,
        workflowId,
        args: [
          {
            draft,
            criticalNodeIds,
            approval: {
              requiredRoles: approvalRolesEnv,
              notifySlackChannel,
            },
          },
        ],
        memo: {
          [(coreWorkflowPkg as any).SECURITY_CONTEXT_MEMO_KEY]: securityContext,
          [(coreWorkflowPkg as any).GOLDEN_CONTEXT_MEMO_KEY]: goldenContext,
        },
      });

      // Phase 2: audit-only approval log for restricted self-ack.
      if (Boolean(body.approvedRestricted)) {
        const toolsById = new Map((snapshot.tools as any[]).map((t) => [t?.name, t]));
        const restrictedToolIds = Array.from(
          new Set(
            (draft?.nodes ?? [])
              .map((n: any) => (typeof n?.type === "string" ? n.type : ""))
              .filter(Boolean)
              .filter((toolId: string) => {
                const t = toolsById.get(toolId);
                if (!t) return false;
                const tier = classifyWorkbenchToolApprovalTier({
                  toolId,
                  dataClassification: String(t.dataClassification ?? ""),
                });
                return tier === "restricted";
              })
          )
        );

        if (restrictedToolIds.length > 0) {
          await appendApprovalLog({
            approverId: typeof (req as any)?.user?.id === "string" ? (req as any).user.id : "workbench-user",
            approvedToolIds: restrictedToolIds,
            context: {
              draftTitle: typeof draft?.title === "string" ? draft.title : undefined,
              workflowId: handle.workflowId,
              contextType: "draft",
            },
          });
        }
      }

      return res.status(200).json({
        workflowId: handle.workflowId,
        runId: handle.firstExecutionRunId,
        taskQueue,
        workflowType: "workbenchDraftRunWorkflow",
      });
    } catch (error: any) {
      console.error("Failed to start workbench draft run workflow:", error);
      return res.status(500).json({ error: "FAILED_TO_START_WORKFLOW", details: error?.message ?? String(error) });
    }
  });

  // Approval audit log (Phase 4.1.5): RESTRICTED tool approvals
  router.get("/approvals/log", async (_req: Request, res: Response) => {
    const limit = Math.min(Number((_req as any).query?.limit) || 50, 100);
    const entries = await listApprovalLog(limit);
    return res.json({ entries });
  });

  router.post("/approvals/log", async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as {
      approverId?: string;
      approvedToolIds?: string[];
      context?: { incidentId?: string; workflowId?: string; draftTitle?: string; contextType?: string };
    };
    const approverId =
      typeof (req as any)?.user?.id === "string"
        ? (req as any).user.id
        : typeof body.approverId === "string"
          ? body.approverId
          : "workbench-user";
    const approvedToolIds = Array.isArray(body.approvedToolIds) ? body.approvedToolIds : [];
    try {
      const entry = await appendApprovalLog({
        approverId,
        approvedToolIds,
        context: body.context,
      });
      return res.status(201).json(entry);
    } catch (error: unknown) {
      if (isApprovalLogValidationError(error)) {
        return res.status(400).json({ error: error.code, message: error.message });
      }
      throw error;
    }
  });

  // Phase 4.5: Workbench usage telemetry (client → server → Prometheus).
  // NOTE: This intentionally does NOT accept raw chat content; only low-cardinality fields.
  router.post("/telemetry", (req: Request, res: Response) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const event = typeof body.event === "string" ? body.event : "";
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
    const timestamp = typeof body.timestamp === "string" ? body.timestamp : "";

    if (!event || !sessionId || !timestamp) {
      return res.status(400).json({ error: "INVALID_TELEMETRY_PAYLOAD" });
    }

    recordWorkbenchTelemetry({
      event,
      durationMs: typeof body.durationMs === "number" ? body.durationMs : undefined,
      status: typeof body.status === "string" ? body.status : undefined,
      approved: typeof body.approved === "boolean" ? body.approved : undefined,
    });

    // Milestone 5: local-first recommendation weighting from existing telemetry signals.
    const intent = typeof body.intent === "string" ? body.intent : "workflow_generation";
    const recipeId = typeof body.recipeId === "string" ? body.recipeId : "";
    if (recipeId && event === "workbench.workflow_run_completed") {
      recordRecommendationOutcome({
        intent,
        recipeId,
        status: typeof body.status === "string" ? body.status : undefined,
        durationMs: typeof body.durationMs === "number" ? body.durationMs : undefined,
        approvalTurnaroundMs:
          typeof body.approvalTurnaroundMs === "number" ? body.approvalTurnaroundMs : undefined,
      });
    }
    if (recipeId && event === "workbench.preflight_failed") {
      recordRecommendationOutcome({
        intent,
        recipeId,
        status: "failed",
        preflightFailureCategory:
          typeof body.preflightFailureCategory === "string" ? body.preflightFailureCategory : "unknown",
      });
    }

    return res.status(204).send();
  });

  router.get("/recommendation-diagnostics", async (req: Request, res: Response) => {
    const intent = typeof req.query.intent === "string" ? req.query.intent : undefined;
    return res.status(200).json(getRecommendationDiagnostics({ intent }));
  });

  router.post("/recipe-feedback", async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as {
      intent?: string;
      recipeId?: string;
      feedback?: "up" | "down";
    };
    if (!body.recipeId || (body.feedback !== "up" && body.feedback !== "down")) {
      return res.status(400).json({ error: "INVALID_RECIPE_FEEDBACK" });
    }
    recordRecipeFeedback({
      intent: body.intent ?? "workflow_generation",
      recipeId: body.recipeId,
      feedback: body.feedback,
    });
    return res.status(204).send();
  });

  router.get("/metrics", async (_req: Request, res: Response) => {
    const { contentType, body } = await getWorkbenchMetricsText();
    res.setHeader("content-type", contentType);
    return res.status(200).send(body);
  });

  // Phase 4.6 / cost-ux: expose in-memory budget totals for UI surfaces.
  router.get("/cost", async (req: any, res: any) => {
    const queryKey = typeof req?.query?.budgetKey === "string" ? req.query.budgetKey : "";
    const budgetKey =
      queryKey && queryKey.length > 0
        ? queryKey
        : typeof req?.user?.id === "string"
          ? `user:${req.user.id}`
          : typeof req?.sessionID === "string" && req.sessionID.length > 0
            ? `session:${req.sessionID}`
            : "session:anonymous";

    const totals = getTotals({ budgetKey });
    const policy = getBudgetPolicy({ budgetKey });
    return res.json({ budgetKey, totals, policy: policy ?? null });
  });

  // Phase 4.6 / cost-ux: configure a budget policy for a given budgetKey.
  router.post("/cost/policy", async (req: any, res: any) => {
    const body = (req.body ?? {}) as any;
    const budgetKey = typeof body.budgetKey === "string" ? body.budgetKey.trim().slice(0, 200) : "";
    const policy = body.policy as any;
    const hardLimitUsd = typeof policy?.hardLimitUsd === "number" ? policy.hardLimitUsd : Number(policy?.hardLimitUsd);
    const window = typeof policy?.window === "string" ? policy.window : "";

    if (!budgetKey) return res.status(400).json({ error: "budgetKey is required" });
    if (!Number.isFinite(hardLimitUsd) || hardLimitUsd < 0) {
      return res.status(400).json({ error: "policy.hardLimitUsd must be a non-negative number" });
    }
    if (window !== "run" && window !== "day") {
      return res.status(400).json({ error: 'policy.window must be "run" or "day"' });
    }

    setBudgetPolicy({ budgetKey, policy: { hardLimitUsd, window } });
    return res.json({
      budgetKey,
      totals: getTotals({ budgetKey }),
      policy: getBudgetPolicy({ budgetKey }) ?? null,
    });
  });

  return router;
}

