import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { registerRoutes } from "./routes";
import { DbFixture } from "./test/db-fixture";
import type { InsertEvent } from "@shared/schema";

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
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));

    httpServer = createServer(app);
    await registerRoutes(httpServer, app);

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


