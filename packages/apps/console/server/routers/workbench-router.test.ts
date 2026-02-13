import express from "express";
import request from "supertest";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createWorkbenchRouter } from "./workbench-router";
import { resetRecommendationScoringForTests } from "../services/golden-path-recipes";

const mocks = vi.hoisted(() => ({
  appendApprovalLog: vi.fn(async (entry: unknown) => ({ id: "approval-1", ...((entry ?? {}) as object) })),
  getTemporalClient: vi.fn(async () => ({
    start: vi.fn(async (_name: string, opts: any) => ({
      workflowId: opts.workflowId ?? "wf-1",
      firstExecutionRunId: "run-1",
    })),
  })),
}));

vi.mock("../audit/approval-log", () => ({
  appendApprovalLog: (entry: unknown) => mocks.appendApprovalLog(entry),
  isApprovalLogValidationError: () => false,
  listApprovalLog: vi.fn(async () => []),
}));

vi.mock("../services/temporal/temporal-client.js", () => ({
  getTemporalClient: () => mocks.getTemporalClient(),
}));

describe("createWorkbenchRouter draft run approval audit", () => {
  beforeEach(() => {
    mocks.appendApprovalLog.mockClear();
    mocks.getTemporalClient.mockClear();
    resetRecommendationScoringForTests();
  });

  it("logs restricted approvals with workflowId and draftTitle context", async () => {
    const app = express();
    app.use(express.json());
    app.use(
      "/api/workbench",
      createWorkbenchRouter({
        mcpToolService: {
          snapshot: () => ({
            manifest: { generated_at: "2026-02-10T00:00:00.000Z", version: "1" },
            tools: [
              {
                name: "golden.restricted.example",
                description: "Restricted tool",
                inputSchema: { type: "object", properties: {} },
                dataClassification: "RESTRICTED",
                type: "CAPABILITY",
              },
            ],
          }),
        } as any,
      })
    );

    const response = await request(app)
      .post("/api/workbench/drafts/run")
      .send({
        approvedRestricted: true,
        draft: {
          title: "Critical production fix",
          summary: "",
          nodes: [{ id: "n1", label: "Restricted step", type: "golden.restricted.example", properties: {} }],
          edges: [],
        },
      })
      .expect(200);

    expect(response.body).toMatchObject({
      workflowId: expect.any(String),
      runId: "run-1",
      workflowType: "workbenchDraftRunWorkflow",
    });

    expect(mocks.appendApprovalLog).toHaveBeenCalledWith(
      expect.objectContaining({
        approvedToolIds: ["golden.restricted.example"],
        context: expect.objectContaining({
          draftTitle: "Critical production fix",
          workflowId: response.body.workflowId,
          contextType: "draft",
        }),
      })
    );
  });

  it("records recipe feedback and exposes selection diagnostics", async () => {
    const app = express();
    app.use(express.json());
    app.use("/api/workbench", createWorkbenchRouter({ mcpToolService: { snapshot: () => ({ manifest: {}, tools: [] }) } as any }));

    await request(app)
      .post("/api/workbench/recipe-feedback")
      .send({
        intent: "workflow_generation",
        recipeId: "incident_triage_comms",
        feedback: "up",
      })
      .expect(204);

    const response = await request(app)
      .get("/api/workbench/recommendation-diagnostics")
      .query({ intent: "workflow_generation" })
      .expect(200);

    expect(response.body.intent).toBe("workflow_generation");
    expect(response.body.weights).toHaveProperty("incident_triage_comms");
  });
});
