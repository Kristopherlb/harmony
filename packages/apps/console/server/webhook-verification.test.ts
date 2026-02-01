import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHmac } from "crypto";
import {
  verifySlackSignature,
  verifyGitLabSignature,
  verifyHmacSignature,
  createWebhookVerificationMiddleware,
  getVerificationStatus,
} from "./webhook-verification";

describe("verifySlackSignature", () => {
  const signingSecret = "test-signing-secret";

  it("should return true for valid signature", () => {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const body = JSON.stringify({ text: "hello" });
    const sigBasestring = `v0:${timestamp}:${body}`;
    const signature = "v0=" + createHmac("sha256", signingSecret)
      .update(sigBasestring)
      .digest("hex");

    expect(verifySlackSignature(signingSecret, signature, timestamp, body)).toBe(true);
  });

  it("should return false for invalid signature", () => {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const body = JSON.stringify({ text: "hello" });

    expect(verifySlackSignature(signingSecret, "v0=invalidsig", timestamp, body)).toBe(false);
  });

  it("should return false for old timestamp", () => {
    const oldTimestamp = (Math.floor(Date.now() / 1000) - 360).toString();
    const body = JSON.stringify({ text: "hello" });
    const sigBasestring = `v0:${oldTimestamp}:${body}`;
    const signature = "v0=" + createHmac("sha256", signingSecret)
      .update(sigBasestring)
      .digest("hex");

    expect(verifySlackSignature(signingSecret, signature, oldTimestamp, body)).toBe(false);
  });
});

describe("verifyGitLabSignature", () => {
  it("should return true when tokens match", () => {
    const secret = "my-gitlab-secret";
    expect(verifyGitLabSignature(secret, secret)).toBe(true);
  });

  it("should return false when tokens do not match", () => {
    expect(verifyGitLabSignature("secret1", "secret2")).toBe(false);
  });
});

describe("verifyHmacSignature", () => {
  const secret = "test-secret";

  it("should verify sha256 signature correctly", () => {
    const body = JSON.stringify({ data: "test" });
    const signature = createHmac("sha256", secret).update(body).digest("hex");

    expect(verifyHmacSignature(secret, signature, body, "sha256")).toBe(true);
  });

  it("should verify sha256 signature with prefix", () => {
    const body = JSON.stringify({ data: "test" });
    const signature = "sha256=" + createHmac("sha256", secret).update(body).digest("hex");

    expect(verifyHmacSignature(secret, signature, body, "sha256")).toBe(true);
  });

  it("should verify sha1 signature correctly", () => {
    const body = JSON.stringify({ data: "test" });
    const signature = createHmac("sha1", secret).update(body).digest("hex");

    expect(verifyHmacSignature(secret, signature, body, "sha1")).toBe(true);
  });

  it("should return false for invalid signature", () => {
    const body = JSON.stringify({ data: "test" });
    expect(verifyHmacSignature(secret, "invalidsig", body, "sha256")).toBe(false);
  });
});

describe("createWebhookVerificationMiddleware", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should call next when secret is not configured (warning mode)", () => {
    delete process.env.SLACK_SIGNING_SECRET;
    const middleware = createWebhookVerificationMiddleware("slack");
    
    const req = { body: {}, headers: {} } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("should return 401 when Slack signature headers are missing", () => {
    process.env.SLACK_SIGNING_SECRET = "test-secret";
    const middleware = createWebhookVerificationMiddleware("slack");
    
    const req = { body: {}, headers: {} } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const next = vi.fn();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Missing Slack signature headers" });
  });

  it("should return 401 when GitLab token header is missing", () => {
    process.env.GITLAB_WEBHOOK_SECRET = "test-secret";
    const middleware = createWebhookVerificationMiddleware("gitlab");
    
    const req = { body: {}, headers: {} } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const next = vi.fn();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Missing GitLab token header" });
  });

  it("should call next when GitLab token is valid", () => {
    const secret = "my-gitlab-secret";
    process.env.GITLAB_WEBHOOK_SECRET = secret;
    const middleware = createWebhookVerificationMiddleware("gitlab");
    
    const req = { 
      body: {}, 
      headers: { "x-gitlab-token": secret } 
    } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("should return 401 when Bitbucket signature is missing", () => {
    process.env.BITBUCKET_WEBHOOK_SECRET = "test-secret";
    const middleware = createWebhookVerificationMiddleware("bitbucket");
    
    const req = { body: {}, headers: {} } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const next = vi.fn();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Missing Bitbucket signature header" });
  });

  it("should call next when Bitbucket signature is valid", () => {
    const secret = "bitbucket-secret";
    process.env.BITBUCKET_WEBHOOK_SECRET = secret;
    const middleware = createWebhookVerificationMiddleware("bitbucket");
    
    const body = {};
    const rawBody = JSON.stringify(body);
    const signature = createHmac("sha256", secret).update(rawBody).digest("hex");
    
    const req = { 
      body, 
      headers: { "x-hub-signature": signature } 
    } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it("should return 400 for unknown source", () => {
    const middleware = createWebhookVerificationMiddleware("unknown");
    
    const req = { body: {}, headers: {} } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const next = vi.fn();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Unknown source: unknown" });
  });
});

describe("getVerificationStatus", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should return false for all sources when no secrets configured", () => {
    delete process.env.SLACK_SIGNING_SECRET;
    delete process.env.GITLAB_WEBHOOK_SECRET;
    delete process.env.BITBUCKET_WEBHOOK_SECRET;
    delete process.env.JIRA_WEBHOOK_SECRET;
    delete process.env.PAGERDUTY_WEBHOOK_SECRET;

    const status = getVerificationStatus();

    expect(status.slack).toBe(false);
    expect(status.gitlab).toBe(false);
    expect(status.bitbucket).toBe(false);
    expect(status.jira).toBe(false);
    expect(status.pagerduty).toBe(false);
  });

  it("should return true for configured sources", () => {
    process.env.SLACK_SIGNING_SECRET = "slack-secret";
    process.env.GITLAB_WEBHOOK_SECRET = "gitlab-secret";
    delete process.env.BITBUCKET_WEBHOOK_SECRET;
    delete process.env.JIRA_WEBHOOK_SECRET;
    delete process.env.PAGERDUTY_WEBHOOK_SECRET;

    const status = getVerificationStatus();

    expect(status.slack).toBe(true);
    expect(status.gitlab).toBe(true);
    expect(status.bitbucket).toBe(false);
    expect(status.jira).toBe(false);
    expect(status.pagerduty).toBe(false);
  });
});
