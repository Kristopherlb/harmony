import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import { createServer } from "http";
import { registerRoutes } from "./routes";
import { SeedableMemoryRepository } from "./storage";
import { createAppDeps } from "./composition";
import type { AppDeps } from "./types/deps";
import { GOLDEN_CONTEXT_MEMO_KEY, SECURITY_CONTEXT_MEMO_KEY } from "@golden/core/workflow";

vi.mock("./services/temporal/temporal-client.js", () => {
  const lastStartOptions: { current: any } = { current: null };
  const start = vi.fn(async (_workflowType: string, opts: any) => {
    lastStartOptions.current = opts;
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

  const list = vi.fn(async function* () {
    // empty
  });

  return {
    getTemporalClient: vi.fn(async () => ({
      start,
      getHandle,
      list,
    })),
    __test: { lastStartOptions },
  };
});

describe("Workflows router - run blueprint", () => {
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

  it("starts a blueprint workflow", async () => {
    const res = await request(app)
      .post("/api/workflows/run-blueprint")
      .send({ blueprintId: "workflows.echo", input: { x: 1 } })
      .expect(200);

    expect(res.body).toMatchObject({
      workflowType: "echoWorkflow",
      taskQueue: "golden-tools",
    });
    expect(res.body.workflowId).toContain("workflows.echo-");
    expect(res.body.runId).toBe("run-1");
  });

  it("includes GoldenContext + SecurityContext memo when starting", async () => {
    const temporal = await import("./services/temporal/temporal-client.js");

    await request(app)
      .post("/api/workflows/run-blueprint")
      .send({ blueprintId: "workflows.echo", input: { x: 1 } })
      .expect(200);

    const opts = (temporal as any).__test.lastStartOptions.current;
    expect(opts).toBeTruthy();
    expect(opts.memo).toBeTruthy();
    expect(opts.memo[SECURITY_CONTEXT_MEMO_KEY]).toBeTruthy();
    expect(opts.memo[GOLDEN_CONTEXT_MEMO_KEY]).toBeTruthy();
  });

  it("returns result when completed", async () => {
    const res = await request(app)
      .get("/api/workflows/wf-1/result")
      .expect(200);

    expect(res.body).toMatchObject({
      workflowId: "wf-1",
      runId: "run-1",
      result: { ok: true },
    });
  });
});

