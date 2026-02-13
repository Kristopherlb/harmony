import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { createWorkbenchRouter } from "./workbench-router";

describe("Workbench router telemetry + metrics (Phase 4.5)", () => {
  const api = () => {
    const app = express();
    app.use(express.json());
    app.use(
      "/api/workbench",
      createWorkbenchRouter({
        // Telemetry/metrics tests don't require MCP state; stub is sufficient.
        mcpToolService: { snapshot: () => ({ manifest: { version: "1", generated_at: "x" }, tools: [] }) } as any,
      })
    );
    return request(app);
  };

  it("accepts analytics taxonomy events via /api/workbench/telemetry", async () => {
    await api()
      .post("/api/workbench/telemetry")
      .send({
        event: "workbench.session_started",
        sessionId: "session-1",
        timestamp: new Date("2026-02-02T00:00:00.000Z").toISOString(),
      })
      .expect(204);
  });

  it("exposes Prometheus metrics via /api/workbench/metrics", async () => {
    await api()
      .post("/api/workbench/telemetry")
      .send({
        event: "workbench.draft_accepted",
        sessionId: "session-1",
        draftId: "draft-1",
        timestamp: new Date("2026-02-02T00:00:10.000Z").toISOString(),
        durationMs: 10_000,
      })
      .expect(204);

    const res = await api().get("/api/workbench/metrics").expect(200);
    expect(res.text).toContain("golden_contract_workbench_events_total");
    expect(res.text).toContain('event="workbench.draft_accepted"');
    expect(res.text).toContain("golden_contract_workbench_event_duration_seconds_bucket");
  });

  it("sets and returns LLM budget policy via /api/workbench/cost/policy", async () => {
    await api()
      .post("/api/workbench/cost/policy")
      .send({ budgetKey: "user:test", policy: { hardLimitUsd: 0.5, window: "run" } })
      .expect(200);

    const res = await api().get("/api/workbench/cost?budgetKey=user:test").expect(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        budgetKey: "user:test",
        policy: { hardLimitUsd: 0.5, window: "run" },
        totals: expect.any(Object),
      })
    );
  });
});

