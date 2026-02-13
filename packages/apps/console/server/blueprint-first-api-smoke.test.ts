import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import { createServer } from "http";
import { registerRoutes } from "./routes";
import { SeedableMemoryRepository } from "./storage";
import { createAppDeps } from "./composition";
import type { AppDeps } from "./types/deps";
import {
  createMcpJsonRpcHandler,
  createToolSurface,
  generateToolManifestFromCapabilities,
} from "@golden/mcp-server";
import { createCapabilityRegistry } from "@golden/capabilities";

vi.mock("./services/temporal/temporal-client.js", () => {
  const start = vi.fn(async (_workflowType: string, opts: any) => {
    return { workflowId: opts.workflowId, firstExecutionRunId: "run-1" };
  });

  const getHandle = vi.fn((_workflowId: string) => {
    return {
      describe: vi.fn(async () => ({
        workflowId: _workflowId,
        runId: "run-1",
        status: { name: "COMPLETED" },
        type: "echoWorkflow",
        startTime: new Date().toISOString(),
        closeTime: new Date().toISOString(),
        historyLength: 3,
      })),
      result: vi.fn(async () => ({ ok: true })),
    };
  });

  const list = vi.fn(async function* () {});

  return {
    getTemporalClient: vi.fn(async () => ({
      start,
      getHandle,
      list,
    })),
  };
});

async function verifyMcpReadiness(api: request.SuperTest<request.Test>): Promise<void> {
  const before = await api.get("/api/mcp/tools").expect(200);
  expect(Array.isArray(before.body.tools)).toBe(true);
  expect(before.body.tools.length).toBeGreaterThan(0);
  expect(Number.isNaN(Date.parse(before.body.manifest.generated_at))).toBe(false);

  const refreshed = await api.post("/api/mcp/tools/refresh").send({}).expect(200);
  expect(Date.parse(refreshed.body.manifest.generated_at)).toBeGreaterThan(
    Date.parse(before.body.manifest.generated_at)
  );

  const manifest = generateToolManifestFromCapabilities({
    registry: createCapabilityRegistry(),
    generated_at: new Date().toISOString(),
    version: "1",
    includeBlueprints: true,
  });
  const toolSurface = createToolSurface({ manifest, traceId: () => "mcp-smoke-trace" });
  const handle = createMcpJsonRpcHandler({
    toolSurface,
    manifestInfo: { version: manifest.version, generated_at: manifest.generated_at },
  });

  const initialize = await handle({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2025-11-25" },
  });
  expect((initialize as any)?.result?.serverInfo?.name).toBe("golden-mcp-server");

  const listTools = await handle({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
  const tools = ((listTools as any)?.result?.tools ?? []) as Array<{ name: string }>;
  expect(tools.some((tool) => tool.name === "golden.echo")).toBe(true);

  const callTool = await handle({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: { name: "golden.echo", arguments: { x: 2 } },
  });
  expect((callTool as any)?.result?.structuredContent?.result?.y).toBe(2);
}

describe("Blueprint-first API smoke", () => {
  let app: express.Express;
  let deps: AppDeps;

  beforeEach(async () => {
    deps = createAppDeps();
    const mockRepository = new SeedableMemoryRepository({ events: [] });
    deps = { ...deps, repository: mockRepository as any };

    app = express();
    app.use(express.json());
    const httpServer = createServer(app);
    await registerRoutes(httpServer, app, deps);
  });

  it("enforces MCP readiness gate before blueprint propose/run API flow", async () => {
    const api = request(app);
    await verifyMcpReadiness(api);

    const proposed = await api
      .post("/api/agent/blueprint/propose")
      .send({ intent: "create an incident workflow with jira and slack" })
      .expect(200);
    expect(Array.isArray(proposed.body.steps)).toBe(true);
    expect(proposed.body.steps.length).toBeGreaterThan(0);

    const started = await api
      .post("/api/workflows/run-blueprint")
      .send({ blueprintId: "workflows.echo", input: { message: "smoke" } })
      .expect(200);
    expect(started.body.workflowId).toContain("workflows.echo-");
    expect(started.body.runId).toBe("run-1");

    await api.get(`/api/workflows/${started.body.workflowId}`).expect(200);
    await api.get(`/api/workflows/${started.body.workflowId}/result`).expect(200);
  });
});
