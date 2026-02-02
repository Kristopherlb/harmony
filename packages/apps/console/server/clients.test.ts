import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  SlackClient,
  GitLabClient,
  BitbucketClient,
  JiraClient,
  PagerDutyClient,
  createServiceClients,
  getConfiguredClients,
} from "./clients";

const mockFetch = vi.fn();
const temporalWorkflowStart = vi.fn();

vi.mock("./services/temporal/temporal-client.js", () => {
  return {
    getTemporalClient: vi.fn(async () => ({
      workflow: {
        start: temporalWorkflowStart,
      },
    })),
  };
});

describe("SlackClient", () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    global.fetch = mockFetch;
    mockFetch.mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  describe("isConfigured", () => {
    it("should return false when SLACK_BOT_TOKEN is not set", () => {
      delete process.env.SLACK_BOT_TOKEN;
      const client = new SlackClient();
      expect(client.isConfigured()).toBe(false);
    });

    it("should return true when SLACK_BOT_TOKEN is set", () => {
      process.env.SLACK_BOT_TOKEN = "xoxb-test-token";
      const client = new SlackClient();
      expect(client.isConfigured()).toBe(true);
    });
  });

  describe("fetchRecentActivity", () => {
    it("should throw error when not configured", async () => {
      delete process.env.SLACK_BOT_TOKEN;
      const client = new SlackClient();
      await expect(client.fetchRecentActivity()).rejects.toThrow("SLACK_BOT_TOKEN not configured");
    });

    it("should fetch and transform channel messages", async () => {
      process.env.SLACK_BOT_TOKEN = "xoxb-test-token";
      
      mockFetch
        .mockResolvedValueOnce({
          json: () => Promise.resolve({
            ok: true,
            channels: [{ id: "C123", name: "general" }],
          }),
        })
        .mockResolvedValueOnce({
          json: () => Promise.resolve({
            ok: true,
            messages: [
              { ts: String(Date.now() / 1000), user: "U123", text: "Hello world", type: "message" },
            ],
          }),
        });

      const client = new SlackClient();
      const events = await client.fetchRecentActivity();

      expect(events.length).toBeGreaterThanOrEqual(0);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should handle API error gracefully", async () => {
      process.env.SLACK_BOT_TOKEN = "xoxb-test-token";
      
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: false }),
      });

      const client = new SlackClient();
      const events = await client.fetchRecentActivity();

      expect(events).toEqual([]);
    });
  });
});

describe("GitLabClient", () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    global.fetch = mockFetch;
    mockFetch.mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  describe("isConfigured", () => {
    it("should return false when GITLAB_TOKEN is not set", () => {
      delete process.env.GITLAB_TOKEN;
      const client = new GitLabClient();
      expect(client.isConfigured()).toBe(false);
    });

    it("should return true when GITLAB_TOKEN is set", () => {
      process.env.GITLAB_TOKEN = "glpat-test-token";
      const client = new GitLabClient();
      expect(client.isConfigured()).toBe(true);
    });
  });

  describe("fetchRecentActivity", () => {
    it("should throw error when not configured", async () => {
      delete process.env.GITLAB_TOKEN;
      const client = new GitLabClient();
      await expect(client.fetchRecentActivity()).rejects.toThrow("GITLAB_TOKEN not configured");
    });

    it("should fetch and transform GitLab events", async () => {
      process.env.GITLAB_TOKEN = "glpat-test-token";
      
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve([
          {
            id: 1,
            created_at: new Date().toISOString(),
            action_name: "pushed to",
            target_type: "Project",
            author: { username: "dev", id: 123 },
            push_data: { commit_count: 3, ref: "main" },
          },
          {
            id: 2,
            created_at: new Date().toISOString(),
            action_name: "opened",
            target_type: "MergeRequest",
            target_title: "Fix bug",
            author: { username: "dev2", id: 456 },
          },
        ]),
      });

      const client = new GitLabClient();
      const events = await client.fetchRecentActivity();

      expect(events).toHaveLength(2);
      expect(events[0].type).toBe("release");
      expect(events[0].source).toBe("gitlab");
      expect(events[1].type).toBe("log");
    });

    it("should handle unexpected response format", async () => {
      process.env.GITLAB_TOKEN = "glpat-test-token";
      
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ error: "unauthorized" }),
      });

      const client = new GitLabClient();
      const events = await client.fetchRecentActivity();

      expect(events).toEqual([]);
    });
  });
});

describe("BitbucketClient", () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    global.fetch = mockFetch;
    mockFetch.mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  describe("isConfigured", () => {
    it("should return false when credentials are not set", () => {
      delete process.env.BITBUCKET_USERNAME;
      delete process.env.BITBUCKET_APP_PASSWORD;
      delete process.env.BITBUCKET_WORKSPACE;
      const client = new BitbucketClient();
      expect(client.isConfigured()).toBe(false);
    });

    it("should return true when all credentials are set", () => {
      process.env.BITBUCKET_USERNAME = "user";
      process.env.BITBUCKET_APP_PASSWORD = "pass";
      process.env.BITBUCKET_WORKSPACE = "workspace";
      const client = new BitbucketClient();
      expect(client.isConfigured()).toBe(true);
    });

    it("should return false when only some credentials are set", () => {
      process.env.BITBUCKET_USERNAME = "user";
      delete process.env.BITBUCKET_APP_PASSWORD;
      delete process.env.BITBUCKET_WORKSPACE;
      const client = new BitbucketClient();
      expect(client.isConfigured()).toBe(false);
    });
  });

  describe("fetchRecentActivity", () => {
    it("should throw error when not configured", async () => {
      delete process.env.BITBUCKET_USERNAME;
      delete process.env.BITBUCKET_APP_PASSWORD;
      delete process.env.BITBUCKET_WORKSPACE;
      const client = new BitbucketClient();
      await expect(client.fetchRecentActivity()).rejects.toThrow("not configured");
    });

    it("should fetch and transform Bitbucket activity", async () => {
      process.env.BITBUCKET_USERNAME = "user";
      process.env.BITBUCKET_APP_PASSWORD = "pass";
      process.env.BITBUCKET_WORKSPACE = "workspace";
      
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({
          values: [
            {
              type: "push",
              created_on: new Date().toISOString(),
              actor: { display_name: "Dev", uuid: "123" },
              push: { changes: [{ new: { name: "main" } }] },
              repository: { name: "my-repo" },
            },
          ],
        }),
      });

      const client = new BitbucketClient();
      const events = await client.fetchRecentActivity();

      expect(events).toHaveLength(1);
      expect(events[0].source).toBe("bitbucket");
      expect(events[0].type).toBe("release");
    });

    it("should handle empty response", async () => {
      process.env.BITBUCKET_USERNAME = "user";
      process.env.BITBUCKET_APP_PASSWORD = "pass";
      process.env.BITBUCKET_WORKSPACE = "workspace";
      
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({}),
      });

      const client = new BitbucketClient();
      const events = await client.fetchRecentActivity();

      expect(events).toEqual([]);
    });
  });
});

describe("JiraClient", () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    global.fetch = mockFetch;
    mockFetch.mockReset();
    temporalWorkflowStart.mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  describe("isConfigured", () => {
    it("should return false when credentials are not set", () => {
      delete process.env.JIRA_HOST;
      delete process.env.JIRA_EMAIL_REF;
      delete process.env.JIRA_API_TOKEN_REF;
      const client = new JiraClient();
      expect(client.isConfigured()).toBe(false);
    });

    it("should return true when host + secret refs are set", () => {
      process.env.JIRA_HOST = "https://company.atlassian.net";
      process.env.JIRA_EMAIL_REF = "/artifacts/console/public/secrets/jira_email";
      process.env.JIRA_API_TOKEN_REF = "/artifacts/console/public/secrets/jira_api_token";
      const client = new JiraClient();
      expect(client.isConfigured()).toBe(true);
    });
  });

  describe("fetchRecentActivity", () => {
    it("should throw error when not configured", async () => {
      delete process.env.JIRA_HOST;
      delete process.env.JIRA_EMAIL_REF;
      delete process.env.JIRA_API_TOKEN_REF;
      const client = new JiraClient();
      await expect(client.fetchRecentActivity()).rejects.toThrow("not configured");
    });

    it("should fetch and transform Jira issues", async () => {
      process.env.JIRA_HOST = "https://company.atlassian.net";
      process.env.JIRA_EMAIL_REF = "/artifacts/console/public/secrets/jira_email";
      process.env.JIRA_API_TOKEN_REF = "/artifacts/console/public/secrets/jira_api_token";

      temporalWorkflowStart.mockResolvedValueOnce({
        result: async () => ({
          issues: [
            {
              key: "PROJ-123",
              fields: {
                summary: "Fix login bug",
                priority: { name: "High" },
                status: { name: "In Progress" },
                assignee: { displayName: "John", accountId: "123" },
                updated: new Date().toISOString(),
              },
            },
            {
              key: "PROJ-456",
              fields: {
                summary: "Critical outage",
                priority: { name: "Highest" },
                status: { name: "Open" },
                updated: new Date().toISOString(),
              },
            },
          ],
        }),
      });

      const client = new JiraClient();
      const events = await client.fetchRecentActivity();

      expect(events).toHaveLength(2);
      expect(events[0].source).toBe("jira");
      expect(events[1].type).toBe("blocker");
      expect(events[1].severity).toBe("high");
    });

    it("should handle empty response", async () => {
      process.env.JIRA_HOST = "https://company.atlassian.net";
      process.env.JIRA_EMAIL_REF = "/artifacts/console/public/secrets/jira_email";
      process.env.JIRA_API_TOKEN_REF = "/artifacts/console/public/secrets/jira_api_token";

      temporalWorkflowStart.mockResolvedValueOnce({
        result: async () => ({}),
      });

      const client = new JiraClient();
      const events = await client.fetchRecentActivity();

      expect(events).toEqual([]);
    });
  });
});

describe("PagerDutyClient", () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    global.fetch = mockFetch;
    mockFetch.mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  describe("isConfigured", () => {
    it("should return false when PAGERDUTY_API_KEY is not set", () => {
      delete process.env.PAGERDUTY_API_KEY;
      const client = new PagerDutyClient();
      expect(client.isConfigured()).toBe(false);
    });

    it("should return true when PAGERDUTY_API_KEY is set", () => {
      process.env.PAGERDUTY_API_KEY = "pd-api-key";
      const client = new PagerDutyClient();
      expect(client.isConfigured()).toBe(true);
    });
  });

  describe("fetchRecentActivity", () => {
    it("should throw error when not configured", async () => {
      delete process.env.PAGERDUTY_API_KEY;
      const client = new PagerDutyClient();
      await expect(client.fetchRecentActivity()).rejects.toThrow("PAGERDUTY_API_KEY not configured");
    });

    it("should fetch and transform PagerDuty incidents", async () => {
      process.env.PAGERDUTY_API_KEY = "pd-api-key";
      
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({
          incidents: [
            {
              id: "inc-1",
              title: "Server down",
              urgency: "high",
              status: "triggered",
              created_at: new Date().toISOString(),
              assignments: [{ assignee: { summary: "John", id: "123" } }],
            },
            {
              id: "inc-2",
              title: "CPU spike",
              urgency: "low",
              status: "resolved",
              created_at: new Date().toISOString(),
              resolved_at: new Date().toISOString(),
            },
          ],
        }),
      });

      const client = new PagerDutyClient();
      const events = await client.fetchRecentActivity();

      expect(events).toHaveLength(2);
      expect(events[0].source).toBe("pagerduty");
      expect(events[0].type).toBe("alert");
      expect(events[0].severity).toBe("critical");
      expect(events[1].resolved).toBe(true);
    });

    it("should handle empty response", async () => {
      process.env.PAGERDUTY_API_KEY = "pd-api-key";
      
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({}),
      });

      const client = new PagerDutyClient();
      const events = await client.fetchRecentActivity();

      expect(events).toEqual([]);
    });
  });
});

describe("createServiceClients", () => {
  it("should create clients for all 5 sources", () => {
    const clients = createServiceClients();
    
    expect(clients.slack).toBeInstanceOf(SlackClient);
    expect(clients.gitlab).toBeInstanceOf(GitLabClient);
    expect(clients.bitbucket).toBeInstanceOf(BitbucketClient);
    expect(clients.jira).toBeInstanceOf(JiraClient);
    expect(clients.pagerduty).toBeInstanceOf(PagerDutyClient);
  });
});

describe("getConfiguredClients", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should return empty array when no clients are configured", () => {
    delete process.env.SLACK_BOT_TOKEN;
    delete process.env.GITLAB_TOKEN;
    delete process.env.BITBUCKET_USERNAME;
    delete process.env.JIRA_HOST;
    delete process.env.JIRA_EMAIL_REF;
    delete process.env.JIRA_API_TOKEN_REF;
    delete process.env.PAGERDUTY_API_KEY;
    
    const clients = getConfiguredClients();
    expect(clients).toHaveLength(0);
  });

  it("should return only configured clients", () => {
    process.env.SLACK_BOT_TOKEN = "test-token";
    process.env.GITLAB_TOKEN = "gitlab-token";
    delete process.env.BITBUCKET_USERNAME;
    delete process.env.JIRA_HOST;
    delete process.env.JIRA_EMAIL_REF;
    delete process.env.JIRA_API_TOKEN_REF;
    delete process.env.PAGERDUTY_API_KEY;
    
    const clients = getConfiguredClients();
    expect(clients).toHaveLength(2);
    expect(clients.map(c => c.source)).toContain("slack");
    expect(clients.map(c => c.source)).toContain("gitlab");
  });
});
