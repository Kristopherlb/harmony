import { Router } from "express";
import type { HarmonyMcpToolService } from "../agent/services/harmony-mcp-tool-service";

export function createMcpToolsRouter(deps: { mcpToolService: HarmonyMcpToolService }) {
  const router = Router();

  // GET /api/mcp/tools
  router.get("/tools", async (_req, res) => {
    try {
      return res.json(deps.mcpToolService.snapshot());
    } catch (error) {
      console.error("Error fetching MCP tools:", error);
      return res.status(500).json({ error: "Failed to fetch MCP tools" });
    }
  });

  // POST /api/mcp/tools/refresh
  // Refresh the tool catalog snapshot served to the Workbench UI.
  router.post("/tools/refresh", async (_req, res) => {
    try {
      return res.json(deps.mcpToolService.refresh());
    } catch (error) {
      console.error("Error refreshing MCP tools:", error);
      return res.status(500).json({ error: "Failed to refresh MCP tools" });
    }
  });

  return router;
}

