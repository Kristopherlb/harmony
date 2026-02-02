import { describe, it, expect, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { createRunbooksRouter } from "./runbooks-router";

describe("RunbooksRouter", () => {
  let app: express.Express;
  let runbooksDir: string;

  beforeEach(async () => {
    app = express();
    runbooksDir = await fs.mkdtemp(path.join(os.tmpdir(), "harmony-runbooks-"));
    await fs.writeFile(
      path.join(runbooksDir, "redis-restart.md"),
      "# Redis Restart\n\nSteps...\n",
      "utf8"
    );
    await fs.writeFile(
      path.join(runbooksDir, "api-health-check.md"),
      "# API Health Check\n\nSteps...\n",
      "utf8"
    );

    app.use("/api/runbooks", createRunbooksRouter({ runbooksDir }));
  });

  it("lists runbooks", async () => {
    const res = await request(app).get("/api/runbooks").expect(200);
    expect(res.body.runbooks).toBeDefined();
    expect(res.body.runbooks.length).toBe(2);
    expect(res.body.runbooks[0]).toHaveProperty("id");
    expect(res.body.runbooks[0]).toHaveProperty("title");
  });

  it("reads a runbook by id", async () => {
    const res = await request(app).get("/api/runbooks/redis-restart").expect(200);
    expect(res.body.id).toBe("redis-restart");
    expect(res.body.title).toBe("Redis Restart");
    expect(res.body.content).toContain("Steps...");
  });
});

