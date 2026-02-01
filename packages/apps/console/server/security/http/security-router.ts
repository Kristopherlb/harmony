// server/security/http/security-router.ts
// HTTP router for security context - parse/validate → use case → map response

import type { Request, Response } from "express";
import { Router as createRouter, type Router } from "express";
import type { SecurityTool } from "@shared/schema";
import { GetSecurityFindings } from "../application/get-security-findings";
import { IngestSecurityFinding } from "../application/ingest-security-finding";
import type { SecurityRepositoryPort } from "../application/ports";

export interface SecurityRouterDeps {
  securityRepository: SecurityRepositoryPort;
  getSecurityAdapter: (tool: SecurityTool) => { transformToFinding: (payload: unknown) => { title: string; status: string; severity: string; tool: string; asset: string; detectedAt: string } | null };
  isValidSecurityTool: (tool: string) => tool is SecurityTool;
}

export function createSecurityRouter(deps: SecurityRouterDeps): Router {
  const router = createRouter();

  const getSecurityFindings = new GetSecurityFindings(deps.securityRepository);

  router.get("/findings", async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = Math.min(parseInt(req.query.pageSize as string) || 50, 100);
      const tool = req.query.tool as SecurityTool | undefined;
      const severity = req.query.severity as "critical" | "high" | "medium" | "low" | undefined;
      const status = req.query.status as "open" | "resolved" | "ignored" | undefined;

      const result = await getSecurityFindings.execute({
        tool,
        severity,
        status,
        page,
        pageSize,
      });

      return res.json(result);
    } catch (error) {
      console.error("Error fetching security findings:", error);
      return res.status(500).json({ error: "Failed to fetch security findings" });
    }
  });

  router.get("/summary", async (_req: Request, res: Response) => {
    try {
      const summary = await deps.securityRepository.getSecuritySummary();
      return res.json(summary);
    } catch (error) {
      console.error("Error fetching security summary:", error);
      return res.status(500).json({ error: "Failed to fetch security summary" });
    }
  });

  router.post("/findings/:id/resolve", async (req: Request, res: Response) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const resolved = await deps.securityRepository.resolveFinding(id);
      
      if (!resolved) {
        return res.status(404).json({ error: "Finding not found" });
      }

      return res.json(resolved);
    } catch (error) {
      console.error("Error resolving security finding:", error);
      return res.status(500).json({ error: "Failed to resolve finding" });
    }
  });

  router.post("/webhooks/:tool", async (req: Request, res: Response) => {
    try {
      const tool = Array.isArray(req.params.tool) ? req.params.tool[0] : req.params.tool;
      
      if (!deps.isValidSecurityTool(tool)) {
        return res.status(400).json({ 
          error: "Invalid security tool",
          valid: ["wiz", "aws_inspector", "artifactory_xray"],
        });
      }

      // Create adapter for this specific tool
      const { SecurityAdapterAdapter } = await import("../adapters/security-adapter-adapter");
      const securityAdapter = deps.getSecurityAdapter(tool);
      const toolAdapter = new SecurityAdapterAdapter(deps.getSecurityAdapter, tool);
      const toolIngestSecurityFinding = new IngestSecurityFinding(toolAdapter, deps.securityRepository);

      const result = await toolIngestSecurityFinding.execute({
        tool,
        payload: req.body,
      });

      if (!result.success) {
        return res.status(400).json({ error: result.error || "Failed to ingest finding" });
      }

      return res.json({ success: true, finding_id: result.findingId });
    } catch (error) {
      console.error(`Error processing security webhook:`, error);
      return res.status(500).json({ error: "Failed to process security webhook" });
    }
  });

  return router;
}
