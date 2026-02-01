// server/composition.test.ts
// Tests for composition root and dependency injection

import { describe, it, expect } from "vitest";
import { createAppDeps } from "./composition";
import express from "express";
import request from "supertest";
import { createServer } from "http";
import { registerRoutes } from "./routes";

describe("Composition Root", () => {
  it("should create AppDeps with all required dependencies", () => {
    const deps = createAppDeps();
    
    expect(deps.repository).toBeDefined();
    expect(deps.actionRepository).toBeDefined();
    expect(deps.workflowEngine).toBeDefined();
    expect(deps.sqlRunner).toBeDefined();
    expect(deps.agentService).toBeDefined();
    expect(deps.chatAgentService).toBeDefined();
    expect(deps.slackAdapter).toBeDefined();
    expect(deps.serviceClients).toBeDefined();
    expect(deps.createWebhookVerificationMiddleware).toBeDefined();
    expect(deps.getVerificationStatus).toBeDefined();
    expect(deps.getAdapter).toBeDefined();
    expect(deps.getSecurityAdapter).toBeDefined();
    expect(deps.isValidSecurityTool).toBeDefined();
    expect(deps.getConfiguredClients).toBeDefined();
  });

  it("should allow routes to be registered with injected deps", async () => {
    const deps = createAppDeps();
    const app = express();
    app.use(express.json());
    const httpServer = createServer(app);

    await registerRoutes(httpServer, app, deps);

    const response = await request(app)
      .get("/api/activity/stream")
      .expect(200);

    expect(response.body).toHaveProperty("events");
    expect(response.body).toHaveProperty("total");
    expect(response.body).toHaveProperty("page");
    expect(response.body).toHaveProperty("pageSize");
  });

  it("should allow injecting mock dependencies for testing", async () => {
    const mockRepository = {
      getEvents: async () => ({ events: [], total: 0 }),
      getEventById: async () => undefined,
      getEventsBySource: async () => [],
      getEventsByUser: async () => [],
      createEvent: async (event: any) => ({ ...event, id: "test-id" }),
      updateEvent: async () => undefined,
      resolveBlocker: async () => undefined,
      getUserStats: async () => ({
        userId: "test",
        username: "test",
        logsThisWeek: 0,
        blockersResolved: 0,
        decisionsLogged: 0,
        totalEvents: 0,
      }),
      getDORAMetrics: async () => ({
        deploymentFrequency: 0,
        leadTime: 0,
        meanTimeToRecovery: 0,
        changeFailureRate: 0,
      }),
      getProjects: async () => [],
      getProjectById: async () => undefined,
      createProject: async (project: any) => ({ ...project, id: "test-id" }),
      updateProject: async () => undefined,
      getFindings: async () => ({ findings: [], total: 0 }),
      getFindingById: async () => undefined,
      createFinding: async (finding: any) => ({ ...finding, id: "test-id" }),
      updateFinding: async () => undefined,
      resolveFinding: async () => undefined,
      getSecuritySummary: async () => ({
        totalOpen: 0,
        bySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
        byTool: { wiz: 0, aws_inspector: 0, artifactory_xray: 0 },
      }),
      getCommentsByEvent: async () => [],
      createComment: async (comment: any) => ({ ...comment, id: "test-id", createdAt: new Date().toISOString() }),
      deleteComment: async () => true,
      getUserProfile: async () => undefined,
      getUserProfileByUsername: async () => undefined,
      getServices: async () => [],
      getServiceById: async () => undefined,
      getTeams: async () => [],
      getTeamById: async () => undefined,
    };

    const deps = createAppDeps();
    const app = express();
    app.use(express.json());
    const httpServer = createServer(app);

    const testDeps = { ...deps, repository: mockRepository as any };

    await registerRoutes(httpServer, app, testDeps);

    const response = await request(app)
      .get("/api/activity/stream")
      .expect(200);

    expect(response.body.events).toEqual([]);
    expect(response.body.total).toBe(0);
  });
});
