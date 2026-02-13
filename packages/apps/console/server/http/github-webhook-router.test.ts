import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import { createServer } from "http";
import crypto from "crypto";
import { registerRoutes } from "../routes";
import { SeedableMemoryRepository } from "../storage";
import { createAppDeps } from "../composition";
import type { AppDeps } from "../types/deps";

vi.mock("../services/temporal/temporal-client.js", () => {
  const lastStartOptions: { current: any } = { current: null };
  const start = vi.fn(async (_workflowType: string, opts: any) => {
    lastStartOptions.current = opts;
    return { workflowId: opts.workflowId, firstExecutionRunId: "run-1" };
  });

  const getHandle = vi.fn((_workflowId: string) => {
    return {
      describe: vi.fn(async () => ({
        workflowId: _workflowId,
        runId: "run-existing",
        status: { name: "RUNNING" },
        type: "githubReleaseWorkflow",
        startTime: new Date().toISOString(),
        closeTime: null,
        historyLength: 1,
      })),
    };
  });

  return {
    getTemporalClient: vi.fn(async () => ({
      start,
      getHandle,
    })),
    __test: { lastStartOptions, start },
  };
});

function signBody(secret: string, rawBody: string): string {
  const digest = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return `sha256=${digest}`;
}

describe("GitHub webhook router", () => {
  let app: express.Express;
  let deps: AppDeps;

  beforeEach(async () => {
    process.env.GITHUB_WEBHOOK_SECRET_REF = "/artifacts/console/public/secrets/github.webhook_secret";
    process.env.GITHUB_TOKEN_SECRET_REF = "/artifacts/console/public/secrets/github.token";
    delete process.env.GITHUB_RELEASE_BLUEPRINT_ID;
    delete process.env.BAO_TOKEN;
    delete process.env.VAULT_TOKEN;
    delete process.env.BAO_ROLE_ID;
    delete process.env.BAO_SECRET_ID;

    const prevFetch = global.fetch;
    global.fetch = vi.fn(async () => {
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({ data: { data: { value: "whsec_test" } } }),
        text: async () => "",
      } as any;
    }) as any;

    deps = createAppDeps();
    const mockRepository = new SeedableMemoryRepository({ events: [] });
    deps = { ...deps, repository: mockRepository as any };

    app = express();
    app.use(express.json());
    const httpServer = createServer(app);
    await registerRoutes(httpServer, app, deps);

    // restore fetch after each test via vitest resetModules is too heavy; just set back here
    // (each test overwrites anyway)
    void prevFetch;
  });

  it("rejects missing signature header", async () => {
    const res = await request(app)
      .post("/api/webhooks/github")
      .set("X-GitHub-Delivery", "d1")
      .set("X-GitHub-Event", "push")
      .send({ repository: { full_name: "octocat/hello-world" } })
      .expect(401);

    expect(res.body).toHaveProperty("error");
  });

  it("starts workflow when signature is valid", async () => {
    const payload = { repository: { full_name: "octocat/hello-world" }, ref: "refs/heads/main", after: "abc" };
    const rawBody = JSON.stringify(payload);
    const sig = signBody("whsec_test", rawBody);

    const res = await request(app)
      .post("/api/webhooks/github")
      .set("X-GitHub-Delivery", "d1")
      .set("X-GitHub-Event", "push")
      .set("X-Hub-Signature-256", sig)
      .send(payload);

    if (res.status !== 200) {
      throw new Error(`Unexpected status ${res.status}: ${JSON.stringify(res.body)}`);
    }

    expect(res.body).toMatchObject({ workflowId: "release-d1", started: true });

    const temporal = await import("../services/temporal/temporal-client.js");
    const opts = (temporal as any).__test.lastStartOptions.current;
    expect(opts.workflowId).toBe("release-d1");
    expect(Array.isArray(opts.args)).toBe(true);
    expect(opts.args[0]).toMatchObject({
      deliveryId: "d1",
      eventType: "push",
      repoFullName: "octocat/hello-world",
      ref: "refs/heads/main",
      sha: "abc",
      githubTokenSecretRef: "/artifacts/console/public/secrets/github.token",
    });
  });

  it("returns 200 and existing runId when workflow already started", async () => {
    const temporal = await import("../services/temporal/temporal-client.js");
    (temporal as any).__test.start.mockImplementationOnce(async () => {
      const err: any = new Error("WorkflowExecutionAlreadyStarted");
      err.name = "WorkflowExecutionAlreadyStartedError";
      throw err;
    });

    const payload = { repository: { full_name: "octocat/hello-world" } };
    const rawBody = JSON.stringify(payload);
    const sig = signBody("whsec_test", rawBody);

    const res = await request(app)
      .post("/api/webhooks/github")
      .set("X-GitHub-Delivery", "d1")
      .set("X-GitHub-Event", "push")
      .set("X-Hub-Signature-256", sig)
      .send(payload);

    if (res.status !== 200) {
      throw new Error(`Unexpected status ${res.status}: ${JSON.stringify(res.body)}`);
    }

    expect(res.body).toMatchObject({ workflowId: "release-d1", started: false, runId: "run-existing" });
  });

  it("supports OpenBao AppRole auth when BAO_TOKEN is not set", async () => {
    process.env.BAO_ROLE_ID = "role-1";
    process.env.BAO_SECRET_ID = "secret-1";
    process.env.BAO_AUTH_MOUNT = "approle";

    const fetchMock = vi.fn(async (url: string, init: any) => {
      if (String(url).includes("/v1/auth/approle/login")) {
        const body = JSON.parse(String(init?.body ?? "{}"));
        expect(body).toMatchObject({ role_id: "role-1", secret_id: "secret-1" });
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          json: async () => ({ auth: { client_token: "t-approle", lease_duration: 3600 } }),
        } as any;
      }
      // KV v2 read
      expect(init?.headers?.["X-Vault-Token"]).toBe("t-approle");
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({ data: { data: { value: "whsec_test" } } }),
        text: async () => "",
      } as any;
    });
    global.fetch = fetchMock as any;

    const payload = { repository: { full_name: "octocat/hello-world" } };
    const rawBody = JSON.stringify(payload);
    const sig = signBody("whsec_test", rawBody);

    const res = await request(app)
      .post("/api/webhooks/github")
      .set("X-GitHub-Delivery", "d1")
      .set("X-GitHub-Event", "push")
      .set("X-Hub-Signature-256", sig)
      .send(payload);

    if (res.status !== 200) {
      throw new Error(`Unexpected status ${res.status}: ${JSON.stringify(res.body)}`);
    }

    expect(res.body).toMatchObject({ workflowId: "release-d1", started: true });
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes("/v1/auth/approle/login"))).toBe(true);
  });
});

