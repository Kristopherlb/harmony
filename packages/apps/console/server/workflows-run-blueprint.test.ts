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
  const lastSignal: { current: any } = { current: null };
  const approvalState: { current: any } = { current: { status: "pending" } };
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
      terminate: vi.fn(async () => undefined),
      query: vi.fn(async () => approvalState.current),
      signal: vi.fn(async (_sig: any, payload: any) => {
        lastSignal.current = payload;
      }),
    };
  });

  const list = vi.fn(async function* () {
    yield {
      workflowId: "wf-pending-1",
      runId: "run-pending-1",
      type: "workbenchDraftRunWorkflow",
      status: { name: "RUNNING" },
      startTime: new Date().toISOString(),
      closeTime: undefined,
    };
  });

  return {
    getTemporalClient: vi.fn(async () => ({
      start,
      getHandle,
      list,
    })),
    __test: { lastStartOptions, lastSignal, approvalState },
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

  it("cancels workflow with POST /:id/cancel (Phase 4.3.3)", async () => {
    const res = await request(app)
      .post("/api/workflows/wf-1/cancel")
      .expect(200);

    expect(res.body).toMatchObject({ ok: true, workflowId: "wf-1" });
  });

  it("returns approval state via GET /:id/approval", async () => {
    const res = await request(app)
      .get("/api/workflows/wf-1/approval")
      .expect(200);
    expect(res.body).toMatchObject({ workflowId: "wf-1", state: { status: "pending" } });
  });

  it("signals approval via POST /:id/approval", async () => {
    const temporal = await import("./services/temporal/temporal-client.js");

    await request(app)
      .post("/api/workflows/wf-1/approval")
      .send({ decision: "approved", approverId: "user:test", approverRoles: ["sre"] })
      .expect(200);

    const last = (temporal as any).__test.lastSignal.current;
    expect(last).toMatchObject({
      decision: "approved",
      approverId: "user:test",
      approverRoles: ["sre"],
      source: "console",
    });
  });

  it("lists pending approvals via GET /pending-approvals", async () => {
    const res = await request(app)
      .get("/api/workflows/pending-approvals?type=workbenchDraftRunWorkflow")
      .expect(200);
    expect(res.body.workflows).toEqual([
      expect.objectContaining({
        workflowId: "wf-pending-1",
        type: "workbenchDraftRunWorkflow",
        state: { status: "pending" },
      }),
    ]);
  });
});

