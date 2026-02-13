import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import { createServer } from "http";
import { registerRoutes } from "./routes";
import { SeedableMemoryRepository } from "./storage";
import type { Event } from "@shared/schema";
import { createAppDeps } from "./composition";
import type { AppDeps } from "./types/deps";

describe("API Routes", () => {
  let app: express.Express;
  let deps: AppDeps;

  beforeEach(async () => {
    // Ensure tests are isolated from developer machine env configuration.
    // (Otherwise local JIRA_* / SLACK_* etc can make sources appear configured unexpectedly.)
    delete process.env.SLACK_BOT_TOKEN;
    delete process.env.SLACK_SIGNING_SECRET;
    delete process.env.NODE_ENV;
    delete process.env.WORKBENCH_ENVIRONMENT;
    delete process.env.GITLAB_TOKEN;
    delete process.env.GITLAB_WEBHOOK_SECRET;
    delete process.env.BITBUCKET_USERNAME;
    delete process.env.BITBUCKET_APP_PASSWORD;
    delete process.env.BITBUCKET_WORKSPACE;
    delete process.env.BITBUCKET_WEBHOOK_SECRET;
    delete process.env.JIRA_HOST;
    delete process.env.JIRA_EMAIL;
    delete process.env.JIRA_API_TOKEN;
    delete process.env.JIRA_WEBHOOK_SECRET;
    delete process.env.PAGERDUTY_API_KEY;
    delete process.env.PAGERDUTY_WEBHOOK_SECRET;
    delete process.env.CIRCLECI_API_TOKEN;

    const mockEvents: Event[] = [
      {
        id: "550e8400-e29b-41d4-a716-446655440001",
        timestamp: new Date().toISOString(),
        source: "slack",
        type: "log",
        severity: "low",
        message: "Test log",
        payload: {},
        userId: "U001",
        username: "testuser",
        resolved: false,
      },
      {
        id: "550e8400-e29b-41d4-a716-446655440002",
        timestamp: new Date().toISOString(),
        source: "pagerduty",
        type: "blocker",
        severity: "critical",
        message: "Test blocker",
        payload: {},
        userId: "U002",
        username: "admin",
        resolved: false,
      },
    ];

    deps = createAppDeps();
    const mockRepository = new SeedableMemoryRepository({ events: mockEvents });
    deps = { ...deps, repository: mockRepository as any };

    app = express();
    app.use(express.json());
    const httpServer = createServer(app);
    await registerRoutes(httpServer, app, deps);
  });

  const api = () => request(app);

  describe("GET /api/activity/stream", () => {
    it("should return paginated events with Zod validated response", async () => {
      const response = await api()
        .get("/api/activity/stream")
        .expect(200);

      expect(response.body).toHaveProperty("events");
      expect(response.body).toHaveProperty("total");
      expect(response.body).toHaveProperty("page");
      expect(response.body).toHaveProperty("pageSize");
      expect(Array.isArray(response.body.events)).toBe(true);
    });

    it("should support page query parameter", async () => {
      const response = await api()
        .get("/api/activity/stream?page=1&pageSize=10")
        .expect(200);

      expect(response.body.page).toBe(1);
      expect(response.body.pageSize).toBe(10);
    });

    it("should limit page size to 100", async () => {
      const response = await api()
        .get("/api/activity/stream?pageSize=200")
        .expect(200);

      expect(response.body.pageSize).toBeLessThanOrEqual(100);
    });
  });

  describe("GET /api/metrics/dora", () => {
    it("should return DORA metrics with Zod validated response", async () => {
      const response = await api()
        .get("/api/metrics/dora")
        .expect(200);

      expect(response.body).toHaveProperty("deploymentFrequency");
      expect(response.body).toHaveProperty("leadTime");
      expect(response.body).toHaveProperty("meanTimeToRecovery");
      expect(response.body).toHaveProperty("changeFailureRate");
      expect(typeof response.body.deploymentFrequency).toBe("number");
      expect(typeof response.body.leadTime).toBe("number");
    });
  });

  describe("POST /api/integrations/slack/events", () => {
    it("should accept valid Slack command and create event", async () => {
      const slackCommand = {
        command: "/ops",
        text: "log This is a test message",
        user_id: "U12345",
        user_name: "testuser",
        channel_id: "C67890",
        channel_name: "ops-channel",
      };

      const response = await api()
        .post("/api/integrations/slack/events")
        .send(slackCommand)
        .expect(200);

      expect(response.body).toHaveProperty("response_type", "in_channel");
      expect(response.body).toHaveProperty("blocks");
      expect(response.body).toHaveProperty("event_id");
    });

    it("should handle blocker command correctly", async () => {
      const slackCommand = {
        command: "/ops",
        text: "blocker Database connection failing",
        user_id: "U12345",
        user_name: "testuser",
        channel_id: "C67890",
        channel_name: "ops-channel",
      };

      const response = await api()
        .post("/api/integrations/slack/events")
        .send(slackCommand)
        .expect(200);

      expect(response.body).toHaveProperty("event_id");
    });

    it("should handle decision command correctly", async () => {
      const slackCommand = {
        command: "/ops",
        text: "decision ADR-001: Use GraphQL for API",
        user_id: "U12345",
        user_name: "testuser",
        channel_id: "C67890",
        channel_name: "ops-channel",
      };

      const response = await api()
        .post("/api/integrations/slack/events")
        .send(slackCommand)
        .expect(200);

      expect(response.body).toHaveProperty("event_id");
    });

    it("should handle status command and return user stats", async () => {
      const slackCommand = {
        command: "/ops",
        text: "status",
        user_id: "U001",
        user_name: "testuser",
        channel_id: "C67890",
        channel_name: "ops-channel",
      };

      const response = await api()
        .post("/api/integrations/slack/events")
        .send(slackCommand)
        .expect(200);

      expect(response.body).toHaveProperty("response_type", "ephemeral");
      expect(response.body).toHaveProperty("blocks");
    });

    it("should reject invalid Slack command payload", async () => {
      const invalidPayload = {
        invalid: "data",
      };

      const response = await api()
        .post("/api/integrations/slack/events")
        .send(invalidPayload)
        .expect(400);

      expect(response.body).toHaveProperty("error");
    });

    it("should reject missing required fields", async () => {
      const incompletePayload = {
        command: "/ops",
      };

      const response = await api()
        .post("/api/integrations/slack/events")
        .send(incompletePayload)
        .expect(400);

      expect(response.body).toHaveProperty("error");
    });
  });

  describe("POST /api/integrations/slack/interactive", () => {
    it("allows unsigned callbacks in local/dev posture", async () => {
      // Default posture in tests is dev/local due to env unset.
      // Send a malformed request that fails fast before any Temporal signaling happens.
      const res = await api()
        .post("/api/integrations/slack/interactive")
        .type("form")
        .send({})
        .expect(400);

      expect(res.body).toHaveProperty("error", "Missing payload");
    });

    it("rejects unsigned callbacks in non-local posture when SLACK_SIGNING_SECRET is missing", async () => {
      // This behavior is determined at router creation time, so we create an isolated server
      // after setting the non-local posture env vars.
      process.env.NODE_ENV = "production";
      process.env.WORKBENCH_ENVIRONMENT = "production";

      const isolatedDeps = createAppDeps();
      const isolatedApp = express();
      isolatedApp.use(express.json());
      const isolatedHttpServer = createServer(isolatedApp);
      await registerRoutes(isolatedHttpServer, isolatedApp, isolatedDeps);

      const res = await request(isolatedApp)
        .post("/api/integrations/slack/interactive")
        .type("form")
        .send({ payload: JSON.stringify({}) })
        .expect(500);

      expect(res.body).toHaveProperty("error", "SLACK_SIGNING_SECRET_REQUIRED");
    });
  });

  describe("GET /api/metrics/users/:userId/stats", () => {
    it("should return user statistics", async () => {
      const response = await api()
        .get("/api/metrics/users/U001/stats")
        .expect(200);

      expect(response.body).toHaveProperty("userId", "U001");
      expect(response.body).toHaveProperty("logsThisWeek");
      expect(response.body).toHaveProperty("blockersResolved");
      expect(response.body).toHaveProperty("decisionsLogged");
      expect(response.body).toHaveProperty("totalEvents");
    });
  });

  describe("POST /api/events/:eventId/resolve", () => {
    it("should resolve a blocker event", async () => {
      const response = await api()
        .post("/api/events/550e8400-e29b-41d4-a716-446655440002/resolve")
        .expect(200);

      expect(response.body.resolved).toBe(true);
      expect(response.body.resolvedAt).toBeDefined();
    });

    it("should return 404 for non-existent event", async () => {
      const response = await api()
        .post("/api/events/non-existent-id/resolve")
        .expect(404);

      expect(response.body).toHaveProperty("error");
    });
  });

  describe("POST /api/integrations/:source/webhook", () => {
    it("should accept GitLab webhook payload", async () => {
      const payload = {
        object_kind: "push",
        ref: "refs/heads/main",
        user_name: "developer",
        commits: [{ message: "Fix bug" }],
      };

      const response = await api()
        .post("/api/integrations/gitlab/webhook")
        .send(payload)
        .expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty("event_id");
    });

    it("should accept PagerDuty webhook payload", async () => {
      const payload = {
        event: {
          event_type: "incident.triggered",
          data: {
            title: "Server alert",
            urgency: "high",
          },
        },
      };

      const response = await api()
        .post("/api/integrations/pagerduty/webhook")
        .send(payload)
        .expect(200);

      expect(response.body).toHaveProperty("success", true);
    });

    it("should reject invalid source", async () => {
      const response = await api()
        .post("/api/integrations/invalid/webhook")
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty("error");
    });
  });

  describe("POST /api/sync/:source", () => {
    it("should return error when source is not configured", async () => {
      const response = await api()
        .post("/api/sync/slack")
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toContain("not configured");
      expect(response.body).toHaveProperty("required");
    });

    it("should reject invalid source", async () => {
      const response = await api()
        .post("/api/sync/invalid")
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty("error", "Invalid source");
    });
  });

  describe("POST /api/sync/all", () => {
    it("should return error when no sources are configured", async () => {
      const response = await api()
        .post("/api/sync/all")
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toContain("No sources configured");
      expect(response.body).toHaveProperty("available");
    });
  });

  describe("GET /api/integrations/status", () => {
    it("should return integration status for all sources", async () => {
      const response = await api()
        .get("/api/integrations/status")
        .expect(200);

      expect(response.body).toHaveProperty("integrations");
      expect(response.body.integrations).toHaveProperty("slack");
      expect(response.body.integrations).toHaveProperty("gitlab");
      expect(response.body.integrations).toHaveProperty("bitbucket");
      expect(response.body.integrations).toHaveProperty("jira");
      expect(response.body.integrations).toHaveProperty("pagerduty");

      expect(response.body.integrations.slack).toHaveProperty("configured");
      expect(response.body.integrations.slack).toHaveProperty("webhookVerified");
    });
  });

  describe("POST /api/actions/execute", () => {
    const auth = {
      "x-user-id": "user-123",
      "x-username": "testuser",
      "x-user-role": "sre",
    };

    it("returns 400 for invalid body (empty object)", async () => {
      const response = await api()
        .post("/api/actions/execute")
        .set(auth)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty("error", "Invalid execution request");
      expect(response.body).toHaveProperty("details");
    });

    it("returns 400 for invalid body (missing actionId)", async () => {
      const response = await api()
        .post("/api/actions/execute")
        .set(auth)
        .send({ params: {}, reasoning: "Valid length reasoning for test." })
        .expect(400);

      expect(response.body).toHaveProperty("error", "Invalid execution request");
    });
  });

  describe("GET /api/actions/approvals/pending (scoped)", () => {
    const auth = {
      "x-user-id": "user-123",
      "x-username": "testuser",
      "x-user-role": "sre",
    };

    it("filters pending approvals by incidentId", async () => {
      const incidentId = "11111111-1111-1111-1111-111111111111";
      const otherIncidentId = "22222222-2222-2222-2222-222222222222";

      await deps.actionRepository.createExecution({
        runId: "run-1",
        actionId: "restart-pods",
        actionName: "Restart Pods",
        status: "pending_approval",
        params: {},
        reasoning: "Need to mitigate incident quickly.",
        executedBy: "user-1",
        executedByUsername: "alice",
        startedAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
        output: [],
        context: {
          eventId: incidentId,
          incidentId,
          contextType: "incident",
          serviceTags: ["api"],
        },
      });

      await deps.actionRepository.createExecution({
        runId: "run-2",
        actionId: "flush-redis-cache",
        actionName: "Flush Redis Cache",
        status: "pending_approval",
        params: {},
        reasoning: "Need to mitigate other incident quickly.",
        executedBy: "user-2",
        executedByUsername: "bob",
        startedAt: new Date("2026-01-01T00:01:00.000Z").toISOString(),
        output: [],
        context: {
          eventId: otherIncidentId,
          incidentId: otherIncidentId,
          contextType: "incident",
          serviceTags: ["redis"],
        },
      });

      const response = await api()
        .get(`/api/actions/approvals/pending?incidentId=${incidentId}`)
        .set(auth)
        .expect(200);

      expect(Array.isArray(response.body.executions)).toBe(true);
      expect(response.body.executions).toHaveLength(1);
      expect(response.body.executions[0].runId).toBe("run-1");
      expect(response.body.total).toBe(1);
    });

    it("filters pending approvals by serviceTag", async () => {
      await deps.actionRepository.createExecution({
        runId: "run-3",
        actionId: "restart-pods",
        actionName: "Restart Pods",
        status: "pending_approval",
        params: {},
        reasoning: "Need to restart pods.",
        executedBy: "user-1",
        executedByUsername: "alice",
        startedAt: new Date("2026-01-01T00:02:00.000Z").toISOString(),
        output: [],
        context: {
          eventId: "33333333-3333-3333-3333-333333333333",
          incidentId: "33333333-3333-3333-3333-333333333333",
          contextType: "incident",
          serviceTags: ["api", "gateway"],
        },
      });

      const response = await api()
        .get("/api/actions/approvals/pending?serviceTag=gateway")
        .set(auth)
        .expect(200);

      expect(response.body.executions).toHaveLength(1);
      expect(response.body.executions[0].runId).toBe("run-3");
    });
  });

  describe("GET /api/actions/executions (scoped)", () => {
    it("does not shadow fixed-prefix routes with /:actionId", async () => {
      await api().get("/api/actions/executions").expect(200);
    });

    it("filters executions by incidentId", async () => {
      const incidentId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
      const otherIncidentId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

      await deps.actionRepository.createExecution({
        runId: "run-x",
        actionId: "restart-pods",
        actionName: "Restart Pods",
        status: "running",
        params: {},
        reasoning: "Restarting during incident.",
        executedBy: "user-1",
        executedByUsername: "alice",
        startedAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
        output: [],
        context: {
          eventId: incidentId,
          incidentId,
          contextType: "incident",
          serviceTags: ["api"],
        },
      });

      await deps.actionRepository.createExecution({
        runId: "run-y",
        actionId: "flush-redis-cache",
        actionName: "Flush Redis Cache",
        status: "running",
        params: {},
        reasoning: "Running for other incident.",
        executedBy: "user-2",
        executedByUsername: "bob",
        startedAt: new Date("2026-01-01T00:01:00.000Z").toISOString(),
        output: [],
        context: {
          eventId: otherIncidentId,
          incidentId: otherIncidentId,
          contextType: "incident",
          serviceTags: ["redis"],
        },
      });

      const response = await api()
        .get(`/api/actions/executions?limit=20&incidentId=${incidentId}`)
        .expect(200);

      expect(response.body.executions).toHaveLength(1);
      expect(response.body.executions[0].runId).toBe("run-x");
      expect(response.body.total).toBe(1);
    });
  });

  describe("GET /api/incidents/:incidentId/timeline", () => {
    it("returns events + executions scoped by incidentId", async () => {
      const incidentId = "cccccccc-cccc-cccc-cccc-cccccccccccc";

      await deps.repository.createEvent({
        timestamp: new Date("2026-01-01T00:00:00.000Z").toISOString(),
        source: "pagerduty",
        type: "alert",
        severity: "critical",
        message: "Incident root event",
        payload: {},
        resolved: false,
        contextType: "incident",
        serviceTags: ["api"],
        incidentId,
      } as any);

      await deps.actionRepository.createExecution({
        runId: "run-tl-1",
        actionId: "restart-pods",
        actionName: "Restart Pods",
        status: "running",
        params: {},
        reasoning: "Mitigate incident.",
        executedBy: "user-1",
        executedByUsername: "alice",
        startedAt: new Date("2026-01-01T00:01:00.000Z").toISOString(),
        output: [],
        context: {
          incidentId,
          contextType: "incident",
          serviceTags: ["api"],
        },
      });

      const response = await api()
        .get(`/api/incidents/${incidentId}/timeline`)
        .expect(200);

      expect(response.body.incidentId).toBe(incidentId);
      expect(Array.isArray(response.body.events)).toBe(true);
      expect(Array.isArray(response.body.executions)).toBe(true);
      expect(response.body.events.length).toBeGreaterThanOrEqual(1);
      expect(response.body.executions.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("POST /api/sql/execute", () => {
    const auth = {
      "x-user-id": "user-123",
      "x-username": "testuser",
      "x-user-role": "dev",
    };

    it("returns 400 for invalid body (empty object)", async () => {
      const response = await api()
        .post("/api/sql/execute")
        .set(auth)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty("error", "Invalid query request");
      expect(response.body).toHaveProperty("details");
    });

    it("returns 400 for invalid body (missing templateId)", async () => {
      const response = await api()
        .post("/api/sql/execute")
        .set(auth)
        .send({ params: {} })
        .expect(400);

      expect(response.body).toHaveProperty("error", "Invalid query request");
    });
  });

  describe("POST /api/workbench/sessions", () => {
    it("returns a derived launchUrl for launch sessions when workbench-server omits it", async () => {
      const prevUrl = process.env.WORKBENCH_SERVER_URL;
      process.env.WORKBENCH_SERVER_URL = "http://127.0.0.1:8787";

      const prevFetch = global.fetch;
      global.fetch = vi.fn(async () => {
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          text: async () =>
            JSON.stringify({
              sessionId: "s1",
              expiresAt: "2026-01-01T00:00:00.000Z",
            }),
        } as any;
      }) as any;

      try {
        const response = await api()
          .post("/api/workbench/sessions")
          .set("origin", "http://localhost:3000")
          .send({ provider: "jira", kind: "openapi", mode: "launch" })
          .expect(200);

        expect(response.body.sessionId).toBe("s1");
        expect(response.body.expiresAt).toBe("2026-01-01T00:00:00.000Z");
        expect(response.body.launchUrl).toBe(
          "http://127.0.0.1:8787/workbench/launch/openapi?sessionId=s1&provider=jira"
        );
      } finally {
        global.fetch = prevFetch;
        if (prevUrl === undefined) delete process.env.WORKBENCH_SERVER_URL;
        else process.env.WORKBENCH_SERVER_URL = prevUrl;
      }
    });

    it("returns WORKBENCH_UNREACHABLE when workbench-server cannot be reached", async () => {
      const prevUrl = process.env.WORKBENCH_SERVER_URL;
      process.env.WORKBENCH_SERVER_URL = "http://127.0.0.1:8787";

      const prevFetch = global.fetch;
      global.fetch = vi.fn(async () => {
        throw new Error("fetch failed");
      }) as any;

      try {
        const response = await api()
          .post("/api/workbench/sessions")
          .set("origin", "http://localhost:3000")
          .send({ provider: "jira", kind: "openapi", mode: "launch" })
          .expect(502);

        expect(response.body.error).toBe("WORKBENCH_UNREACHABLE");
        expect(String(response.body.target ?? "")).toContain("/workbench/sessions");
      } finally {
        global.fetch = prevFetch;
        if (prevUrl === undefined) delete process.env.WORKBENCH_SERVER_URL;
        else process.env.WORKBENCH_SERVER_URL = prevUrl;
      }
    });
  });

  describe("MCP tools catalog freshness", () => {
    it("returns a parseable generated_at timestamp", async () => {
      const response = await api().get("/api/mcp/tools").expect(200);
      expect(response.body).toHaveProperty("manifest");
      expect(response.body.manifest).toHaveProperty("generated_at");
      expect(Number.isNaN(Date.parse(response.body.manifest.generated_at))).toBe(false);
    });

    it("refresh updates generated_at", async () => {
      const before = await api().get("/api/mcp/tools").expect(200);
      const beforeTs = before.body.manifest.generated_at;

      const refreshed = await api().post("/api/mcp/tools/refresh").send({}).expect(200);
      const refreshedTs = refreshed.body.manifest.generated_at;
      expect(Date.parse(refreshedTs)).toBeGreaterThan(Date.parse(beforeTs));

      const after = await api().get("/api/mcp/tools").expect(200);
      const afterTs = after.body.manifest.generated_at;
      expect(Date.parse(afterTs)).toBeGreaterThan(Date.parse(beforeTs));
    });
  });

  describe("GET /api/templates (workflow library)", () => {
    it("returns template manifest with version and templates array", async () => {
      const response = await api().get("/api/templates").expect(200);
      expect(response.body).toHaveProperty("templates");
      expect(Array.isArray(response.body.templates)).toBe(true);
      expect(response.body).toMatchObject({ version: expect.any(String) });
      for (const t of response.body.templates) {
        expect(t).toHaveProperty("id");
        expect(t).toHaveProperty("title");
        expect(t).toHaveProperty("nodes");
        expect(t).toHaveProperty("edges");
      }
    });
  });

  describe("GET/POST /api/workbench/approvals/log (Phase 4.1.5)", () => {
    it("GET returns entries array", async () => {
      const response = await api().get("/api/workbench/approvals/log").expect(200);
      expect(response.body).toHaveProperty("entries");
      expect(Array.isArray(response.body.entries)).toBe(true);
    });

    it("POST records approval and returns 201", async () => {
      const response = await api()
        .post("/api/workbench/approvals/log")
        .send({ approverId: "test-user", approvedToolIds: ["tool.restricted"], context: { draftTitle: "Test" } })
        .expect(201);
      expect(response.body).toHaveProperty("id");
      expect(response.body.approverId).toBe("test-user");
      expect(response.body.approvedToolIds).toEqual(["tool.restricted"]);
      expect(response.body).toHaveProperty("timestamp");
    });

    it("POST 400 when approvedToolIds empty", async () => {
      await api()
        .post("/api/workbench/approvals/log")
        .send({ approverId: "u", approvedToolIds: [] })
        .expect(400);
    });

    it("POST 400 when approval context has no workflowId, incidentId, or draftTitle", async () => {
      const response = await api()
        .post("/api/workbench/approvals/log")
        .send({
          approverId: "u",
          approvedToolIds: ["tool.restricted"],
          context: { contextType: "draft" },
        })
        .expect(400);

      expect(response.body).toHaveProperty("error", "APPROVAL_CONTEXT_REQUIRED");
    });

    it("POST accepts context when incidentId is provided", async () => {
      const response = await api()
        .post("/api/workbench/approvals/log")
        .send({
          approverId: "u",
          approvedToolIds: ["tool.restricted"],
          context: { incidentId: "incident-123", contextType: "incident" },
        })
        .expect(201);

      expect(response.body.context).toMatchObject({ incidentId: "incident-123", contextType: "incident" });
    });
  });

  describe("Workbench telemetry (Phase 4.5)", () => {
    it("accepts a workbench analytics event", async () => {
      await api()
        .post("/api/workbench/telemetry")
        .send({
          event: "workbench.session_started",
          sessionId: "session-1",
          timestamp: new Date("2026-02-02T00:00:00.000Z").toISOString(),
        })
        .expect(204);
    });

    it("exposes recorded telemetry as Prometheus metrics", async () => {
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

    it("returns 400 for invalid telemetry payload", async () => {
      await api().post("/api/workbench/telemetry").send({}).expect(400);
    });
  });
});
