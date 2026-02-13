import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { registerRoutes } from "./routes";
import { DbFixture } from "./test/db-fixture";
import { createAppDeps } from "./composition";
import type { AppDeps } from "./types/deps";

/**
 * Integration test for routes using Postgres repository.
 * This test will fail until PostgresRepository is implemented and wired up.
 * 
 * These tests are skipped if DATABASE_URL is not set (integration tests require database).
 */
const shouldSkip = !process.env.DATABASE_URL;
describe.skipIf(shouldSkip)("Routes - Postgres Integration", () => {
  let app: Express;
  let httpServer: Server;
  let fixture: DbFixture;
  let originalRepoMode: string | undefined;
  let deps: AppDeps;

  beforeAll(async () => {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("DATABASE_URL must be set for Postgres integration tests");
    }
    fixture = new DbFixture(databaseUrl);

    // Save original REPOSITORY_MODE
    originalRepoMode = process.env.REPOSITORY_MODE;

    // Set REPOSITORY_MODE to postgres for this test suite
    process.env.REPOSITORY_MODE = "postgres";
  });

  afterAll(async () => {
    // Restore original REPOSITORY_MODE
    if (originalRepoMode !== undefined) {
      process.env.REPOSITORY_MODE = originalRepoMode;
    } else {
      delete process.env.REPOSITORY_MODE;
    }

    await fixture.close();
    if (httpServer) {
      await new Promise<void>((resolve) => {
        httpServer.close(() => resolve());
      });
    }
  });

  beforeEach(async () => {
    // Create fresh Express app for each test
    deps = createAppDeps();
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));

    httpServer = createServer(app);
    await registerRoutes(httpServer, app, deps);

    // Clean up any existing data
    await fixture.truncateTables();
  });

  it("should serve GET /api/activity/stream with events from Postgres", async () => {
    // This test will fail until PostgresRepository is implemented
    // For now, we're writing the test first (TDD)

    // TODO: Once PostgresRepository is implemented, we can seed data via the repository:
    // const repository = getRepository(); // from storage.ts
    // await repository.createEvent({ ... });

    // For now, we expect this to fail with a helpful error
    const response = await request(app)
      .get("/api/activity/stream")
      .query({ page: 1, pageSize: 10 })
      .expect(200);

    // Once PostgresRepository works, these assertions should pass:
    expect(response.body).toHaveProperty("events");
    expect(response.body).toHaveProperty("total");
    expect(response.body).toHaveProperty("page");
    expect(response.body).toHaveProperty("pageSize");
    expect(Array.isArray(response.body.events)).toBe(true);
  });

  it("persists and lists approval log entries via /api/workbench/approvals/log", async () => {
    await request(app)
      .post("/api/workbench/approvals/log")
      .send({
        approverId: "postgres-test-user",
        approvedToolIds: ["tool.restricted"],
        context: { incidentId: "incident-1", workflowId: "wf-1", contextType: "draft", draftTitle: "Test" },
      })
      .expect(201);

    const response = await request(app).get("/api/workbench/approvals/log").expect(200);
    expect(Array.isArray(response.body.entries)).toBe(true);
    expect(response.body.entries.length).toBeGreaterThanOrEqual(1);
    expect(response.body.entries[0]).toMatchObject({
      approverId: "postgres-test-user",
      approvedToolIds: ["tool.restricted"],
      context: { incidentId: "incident-1", workflowId: "wf-1", contextType: "draft", draftTitle: "Test" },
    });
  });

  it("rejects approval log entries with no actionable context", async () => {
    const response = await request(app)
      .post("/api/workbench/approvals/log")
      .send({
        approverId: "postgres-test-user",
        approvedToolIds: ["tool.restricted"],
        context: { contextType: "draft" },
      })
      .expect(400);

    expect(response.body).toMatchObject({ error: "APPROVAL_CONTEXT_REQUIRED" });
  });

  it("should handle pagination correctly with Postgres data", async () => {
    // TODO: Seed 25 events via repository
    // Then test pagination:
    // const page1 = await request(app).get("/api/activity/stream").query({ page: 1, pageSize: 10 });
    // expect(page1.body.total).toBe(25);
    // expect(page1.body.events).toHaveLength(10);
    //
    // const page2 = await request(app).get("/api/activity/stream").query({ page: 2, pageSize: 10 });
    // expect(page2.body.events).toHaveLength(10);
  });
});


