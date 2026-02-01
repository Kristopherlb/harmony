import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  SlackClient,
  GitLabClient,
  BitbucketClient,
  JiraClient,
  PagerDutyClient,
  CircleCIClient,
  createServiceClients,
  getConfiguredClients,
} from "../clients";
import {
  CircleCITestScenarios,
  createMockPipelinePage,
  createMockWorkflowPage,
  createMockJobPage,
  createMockPipeline,
  createMockWorkflow,
  createMockJob,
} from "./clients.circleci.mocks";

const mockFetch = vi.fn();

vi.mock("../services/temporal/temporal-client.js", () => {
  return { getTemporalClient: vi.fn() };
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

    it("should return false when only API token and workspace are set (client requires username and app password)", () => {
      delete process.env.BITBUCKET_USERNAME;
      delete process.env.BITBUCKET_APP_PASSWORD;
      process.env.BITBUCKET_API_TOKEN = "token";
      process.env.BITBUCKET_WORKSPACE = "workspace";
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
        ok: true,
        status: 200,
        statusText: "OK",
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
        ok: true,
        status: 200,
        statusText: "OK",
        json: () => Promise.resolve({}),
      });

      const client = new BitbucketClient();
      const events = await client.fetchRecentActivity();

      expect(events).toEqual([]);
    });
  });

  describe.skip("fetchMergedPullRequestsForReleaseBranch", () => {
    it("should paginate and return merged PRs targeting the release branch within the window", async () => {
      process.env.BITBUCKET_USERNAME = "user";
      process.env.BITBUCKET_APP_PASSWORD = "pass";
      process.env.BITBUCKET_WORKSPACE = "workspace";

      const windowStart = new Date("2026-01-01T00:00:00.000Z");
      const windowEnd = new Date("2026-02-01T00:00:00.000Z");

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              values: [
                {
                  id: 101,
                  title: "PR 101",
                  merged_on: "2026-01-10T12:00:00.000Z",
                  destination: { branch: { name: "release/11.0.40" } },
                  source: { branch: { name: "feature/foo" } },
                  author: { display_name: "Dev A" },
                },
                {
                  id: 102,
                  title: "Outside window",
                  merged_on: "2025-12-10T12:00:00.000Z",
                  destination: { branch: { name: "release/11.0.40" } },
                },
              ],
              next: "https://api.bitbucket.org/2.0/repositories/acme/my-repo/pullrequests?page=2",
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              values: [
                {
                  id: 103,
                  title: "PR 103",
                  merged_on: "2026-01-15T12:00:00.000Z",
                  destination: { branch: { name: "release/11.0.40" } },
                  author: { display_name: "Dev B" },
                },
              ],
            }),
        });

      const client = new BitbucketClient();
      const records = await client.fetchMergedPullRequestsForReleaseBranch({
        repoKey: "acme/my-repo",
        releaseBranch: "release/11.0.40",
        windowStart,
        windowEnd,
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(records).toHaveLength(2);
      expect(records.map((r) => r.prId)).toEqual([101, 103]);
      expect(records[0]).toMatchObject({
        repoKey: "acme/my-repo",
        releaseBranch: "release/11.0.40",
        prId: 101,
        author: "Dev A",
      });
    });

    it("should cache results for the same (repoKey, releaseBranch, window) tuple", async () => {
      process.env.BITBUCKET_USERNAME = "user";
      process.env.BITBUCKET_APP_PASSWORD = "pass";
      process.env.BITBUCKET_WORKSPACE = "workspace";

      const windowStart = new Date("2026-01-01T00:00:00.000Z");
      const windowEnd = new Date("2026-02-01T00:00:00.000Z");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            values: [
              {
                id: 201,
                title: "PR 201",
                merged_on: "2026-01-20T12:00:00.000Z",
                destination: { branch: { name: "release/11.0.40" } },
              },
            ],
          }),
      });

      const client = new BitbucketClient();
      const first = await client.fetchMergedPullRequestsForReleaseBranch({
        repoKey: "acme/my-repo",
        releaseBranch: "release/11.0.40",
        windowStart,
        windowEnd,
      });
      const second = await client.fetchMergedPullRequestsForReleaseBranch({
        repoKey: "acme/my-repo",
        releaseBranch: "release/11.0.40",
        windowStart,
        windowEnd,
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(first).toEqual(second);
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
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  describe("isConfigured", () => {
    it("should return false when credentials are not set", () => {
      delete process.env.JIRA_HOST;
      delete process.env.JIRA_EMAIL;
      delete process.env.JIRA_API_TOKEN;
      const client = new JiraClient();
      expect(client.isConfigured()).toBe(false);
    });

    it("should return true when all credentials are set", () => {
      process.env.JIRA_HOST = "https://company.atlassian.net";
      process.env.JIRA_EMAIL = "user@company.com";
      process.env.JIRA_API_TOKEN = "token123";
      const client = new JiraClient();
      expect(client.isConfigured()).toBe(true);
    });
  });

  describe("fetchRecentActivity", () => {
    it("should throw error when not configured", async () => {
      delete process.env.JIRA_HOST;
      delete process.env.JIRA_EMAIL;
      delete process.env.JIRA_API_TOKEN;
      const client = new JiraClient();
      await expect(client.fetchRecentActivity()).rejects.toThrow("not configured");
    });

    it("should execute Jira capability via Temporal and transform Jira issues", async () => {
      process.env.JIRA_HOST = "https://company.atlassian.net";
      process.env.JIRA_EMAIL = "user@company.com";
      process.env.JIRA_API_TOKEN = "token123";
      
      const started: Array<{ workflowType: string; args: unknown[]; memo?: Record<string, unknown> }> = [];
      const fakeTemporal = {
        workflow: {
          start: async (workflowType: string, opts: any) => {
            started.push({ workflowType, args: opts.args, memo: opts.memo });
            return {
              workflowId: opts.workflowId,
              firstExecutionRunId: "run-1",
              result: async () => {
                return {
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
                };
              },
            };
          },
        },
      };

      const { getTemporalClient } = await import("../services/temporal/temporal-client.js");
      (getTemporalClient as any).mockResolvedValue(fakeTemporal);

      const client = new JiraClient();
      const events = await client.fetchRecentActivity();

      expect(events).toHaveLength(2);
      expect(events[0].source).toBe("jira");
      expect(events[1].type).toBe("blocker");
      expect(events[1].severity).toBe("high");
      expect(mockFetch).not.toHaveBeenCalled();
      expect(started[0]?.workflowType).toBe("executeCapabilityWorkflow");
    });

    it("should include assignee information in payload for assigned issues", async () => {
      process.env.JIRA_HOST = "https://company.atlassian.net";
      process.env.JIRA_EMAIL = "user@company.com";
      process.env.JIRA_API_TOKEN = "token123";
      
      const assignee = { displayName: "Jane Doe", accountId: "account-123" };
      
      const fakeTemporal = {
        workflow: {
          start: async (_workflowType: string, opts: any) => {
            return {
              workflowId: opts.workflowId,
              firstExecutionRunId: "run-1",
              result: async () => {
                return {
                  issues: [
                    {
                      key: "PROJ-789",
                      fields: {
                        summary: "Test issue with assignee",
                        priority: { name: "Medium" },
                        status: { name: "In Progress" },
                        assignee,
                        updated: new Date().toISOString(),
                      },
                    },
                  ],
                };
              },
            };
          },
        },
      };
      const { getTemporalClient } = await import("../services/temporal/temporal-client.js");
      (getTemporalClient as any).mockResolvedValue(fakeTemporal);

      const client = new JiraClient();
      const events = await client.fetchRecentActivity();

      expect(events).toHaveLength(1);
      expect(events[0].payload).toHaveProperty("key", "PROJ-789");
      expect(events[0].payload).toHaveProperty("fields");
      
      const payload = events[0].payload as { fields?: { assignee?: { displayName?: string; accountId?: string } } };
      expect(payload.fields?.assignee?.displayName).toBe("Jane Doe");
      expect(payload.fields?.assignee?.accountId).toBe("account-123");
      expect(events[0].username).toBe("Jane Doe");
      expect(events[0].userId).toBe("account-123");
    });

    it("should handle issues without assignee", async () => {
      process.env.JIRA_HOST = "https://company.atlassian.net";
      process.env.JIRA_EMAIL = "user@company.com";
      process.env.JIRA_API_TOKEN = "token123";
      
      const fakeTemporal = {
        workflow: {
          start: async (_workflowType: string, opts: any) => {
            return {
              workflowId: opts.workflowId,
              firstExecutionRunId: "run-1",
              result: async () => {
                return {
                  issues: [
                    {
                      key: "PROJ-999",
                      fields: {
                        summary: "Unassigned issue",
                        priority: { name: "Low" },
                        status: { name: "To Do" },
                        updated: new Date().toISOString(),
                      },
                    },
                  ],
                };
              },
            };
          },
        },
      };
      const { getTemporalClient } = await import("../services/temporal/temporal-client.js");
      (getTemporalClient as any).mockResolvedValue(fakeTemporal);

      const client = new JiraClient();
      const events = await client.fetchRecentActivity();

      expect(events).toHaveLength(1);
      const payload = events[0].payload as { fields?: { assignee?: unknown } };
      expect(payload.fields?.assignee).toBeUndefined();
      expect(events[0].username).toBeUndefined();
      expect(events[0].userId).toBeUndefined();
    });

    it("should handle empty response", async () => {
      process.env.JIRA_HOST = "https://company.atlassian.net";
      process.env.JIRA_EMAIL = "user@company.com";
      process.env.JIRA_API_TOKEN = "token123";
      
      const fakeTemporal = {
        workflow: {
          start: async (_workflowType: string, opts: any) => {
            return {
              workflowId: opts.workflowId,
              firstExecutionRunId: "run-1",
              result: async () => {
                return {};
              },
            };
          },
        },
      };
      const { getTemporalClient } = await import("../services/temporal/temporal-client.js");
      (getTemporalClient as any).mockResolvedValue(fakeTemporal);

      const client = new JiraClient();
      const events = await client.fetchRecentActivity();

      expect(events).toEqual([]);
    });
  });

  describe.skip("postComment", () => {
    it("should throw error when not configured", async () => {
      delete process.env.JIRA_HOST;
      delete process.env.JIRA_EMAIL;
      delete process.env.JIRA_API_TOKEN;
      const client = new JiraClient();
      await expect(client.postComment("PROJ-123", "Test comment")).rejects.toThrow("not configured");
    });

    it("should post comment to Jira issue", async () => {
      process.env.JIRA_HOST = "https://company.atlassian.net";
      process.env.JIRA_EMAIL = "user@company.com";
      process.env.JIRA_API_TOKEN = "token123";
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: "10000",
          body: {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Test comment" }],
              },
            ],
          },
        }),
      });

      const client = new JiraClient();
      await client.postComment("PROJ-123", "Test comment");

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://company.atlassian.net/rest/api/3/issue/PROJ-123/comment",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            Authorization: expect.stringContaining("Basic"),
          }),
        })
      );

      const callArgs = mockFetch.mock.calls[0][1];
      const body = JSON.parse(callArgs.body as string);
      expect(body.body.content[0].content[0].text).toBe("Test comment");
    });

    it("should throw error when Jira API returns error", async () => {
      process.env.JIRA_HOST = "https://company.atlassian.net";
      process.env.JIRA_EMAIL = "user@company.com";
      process.env.JIRA_API_TOKEN = "token123";
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: "Forbidden",
        json: () => Promise.resolve({
          errorMessages: ["Issue does not exist or you do not have permission to see it."],
        }),
      });

      const client = new JiraClient();
      await expect(client.postComment("PROJ-123", "Test comment")).rejects.toThrow(
        "Failed to post comment to Jira"
      );
    });
  });

  describe.skip("updateIssue", () => {
    it("should throw error when not configured", async () => {
      delete process.env.JIRA_HOST;
      delete process.env.JIRA_EMAIL;
      delete process.env.JIRA_API_TOKEN;
      const client = new JiraClient();
      await expect(client.updateIssue("PROJ-123", { status: "Done" })).rejects.toThrow("not configured");
    });

    it("should update Jira issue status", async () => {
      process.env.JIRA_HOST = "https://company.atlassian.net";
      process.env.JIRA_EMAIL = "user@company.com";
      process.env.JIRA_API_TOKEN = "token123";
      
      mockFetch
        // GET transitions
        .mockResolvedValueOnce({
          ok: true,
          statusText: "OK",
          json: () => Promise.resolve({
            transitions: [
              { id: "1", name: "Done", to: { name: "Done", id: "done" } },
            ],
          }),
        })
        // POST transition
        .mockResolvedValueOnce({
          ok: true,
          statusText: "OK",
          json: () => Promise.resolve({}),
        });

      const client = new JiraClient();
      await client.updateIssue("PROJ-123", { status: "Done" });

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        "https://company.atlassian.net/rest/api/3/issue/PROJ-123/transitions",
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            Authorization: expect.stringContaining("Basic"),
            Accept: "application/json",
          }),
        })
      );

      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        "https://company.atlassian.net/rest/api/3/issue/PROJ-123/transitions",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: expect.stringContaining("Basic"),
            "Content-Type": "application/json",
            Accept: "application/json",
          }),
        })
      );

      const callArgs = mockFetch.mock.calls[1][1];
      const body = JSON.parse(callArgs.body as string);
      expect(body.transition.id).toBe("1");
    });

    it("should update Jira issue priority", async () => {
      process.env.JIRA_HOST = "https://company.atlassian.net";
      process.env.JIRA_EMAIL = "user@company.com";
      process.env.JIRA_API_TOKEN = "token123";
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const client = new JiraClient();
      await client.updateIssue("PROJ-123", { priority: "High" });

      const callArgs = mockFetch.mock.calls[0][1];
      const body = JSON.parse(callArgs.body as string);
      expect(body.fields.priority.name).toBe("High");
    });

    it("should update multiple fields at once", async () => {
      process.env.JIRA_HOST = "https://company.atlassian.net";
      process.env.JIRA_EMAIL = "user@company.com";
      process.env.JIRA_API_TOKEN = "token123";
      
      mockFetch
        // GET transitions
        .mockResolvedValueOnce({
          ok: true,
          statusText: "OK",
          json: () => Promise.resolve({
            transitions: [
              { id: "2", name: "In Progress", to: { name: "In Progress", id: "inprogress" } },
            ],
          }),
        })
        // POST transition
        .mockResolvedValueOnce({
          ok: true,
          statusText: "OK",
          json: () => Promise.resolve({}),
        })
        // PUT fields update
        .mockResolvedValueOnce({
          ok: true,
          statusText: "OK",
          json: () => Promise.resolve({}),
        });

      const client = new JiraClient();
      await client.updateIssue("PROJ-123", { 
        status: "In Progress", 
        priority: "High",
        severity: "high",
        resolution: "Fixed"
      });

      expect(mockFetch).toHaveBeenCalledTimes(3);

      const callArgs = mockFetch.mock.calls[2][1];
      const body = JSON.parse(callArgs.body as string);
      expect(body.fields.priority.name).toBe("High");
      expect(body.fields.customfield_10000?.value).toBe("high"); // severity custom field
      expect(body.fields.resolution.name).toBe("Fixed");
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

describe("CircleCIClient", () => {
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
    it("should return false when CIRCLECI_API_TOKEN is not set", () => {
      delete process.env.CIRCLECI_API_TOKEN;
      const client = new CircleCIClient();
      expect(client.isConfigured()).toBe(false);
    });

    it("should return true when CIRCLECI_API_TOKEN and CIRCLECI_PROJECT_SLUG are set", () => {
      process.env.CIRCLECI_API_TOKEN = "cci-token";
      process.env.CIRCLECI_PROJECT_SLUG = "bb/ninjarmm/cdk-ninja-region-compute";
      const client = new CircleCIClient();
      expect(client.isConfigured()).toBe(true);
    });
  });

  describe("fetchRecentActivity", () => {
    it("should throw error when not configured", async () => {
      delete process.env.CIRCLECI_API_TOKEN;
      const client = new CircleCIClient();
      await expect(client.fetchRecentActivity()).rejects.toThrow("CIRCLECI_API_TOKEN not configured");
    });

    it("should fetch pipelines and workflows and emit release events for successful deploy workflows", async () => {
      process.env.CIRCLECI_API_TOKEN = "cci-token";
      process.env.CIRCLECI_PROJECT_SLUG = "bb/ninjarmm/cdk-ninja-region-compute";
      process.env.CIRCLECI_RELEASE_BRANCH_REGEX = "^release";
      process.env.CIRCLECI_DEPLOY_WORKFLOW_REGEX = "deploy";
      process.env.CIRCLECI_DEPLOY_JOB_REGEX = ".*";

      const now = new Date();
      const createdAt = now.toISOString();
      const stoppedAt = now.toISOString();

      const controlChar = String.fromCharCode(0x01);
      const invalidJson =
        `{"items":[{"id":"p1","created_at":"${createdAt}","state":"created","vcs":{"branch":"release/11.0.0","revision":"abc","commit":{"subject":"bad${controlChar}"}}}],"next_page_token":null}`;

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(invalidJson),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            items: [
              {
                id: "w1",
                name: "deploy-ca",
                status: "success",
                created_at: createdAt,
                stopped_at: stoppedAt,
              },
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            items: [
              {
                name: "deploy-ca",
                status: "success",
                started_at: createdAt,
                stopped_at: stoppedAt,
              },
            ],
          }),
        });

      const client = new CircleCIClient();
      const events = await client.fetchRecentActivity({ limit: 5 });

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        "https://circleci.com/api/v2/project/bb/ninjarmm/cdk-ninja-region-compute/pipeline",
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            "Circle-Token": "cci-token",
            Accept: "application/json",
          }),
        })
      );
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        "https://circleci.com/api/v2/pipeline/p1/workflow",
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            "Circle-Token": "cci-token",
            Accept: "application/json",
          }),
        })
      );
      expect(mockFetch).toHaveBeenNthCalledWith(
        3,
        "https://circleci.com/api/v2/workflow/w1/job",
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            "Circle-Token": "cci-token",
            Accept: "application/json",
          }),
        })
      );

      expect(events).toHaveLength(1);
      expect(events[0].source).toBe("circleci");
      expect(events[0].type).toBe("release");
      expect(events[0].message).toContain("deploy-ca");
      expect(events[0].payload).toHaveProperty("projectSlug", "bb/ninjarmm/cdk-ninja-region-compute");
      expect(events[0].payload).toHaveProperty("repoKey", "ninjarmm/cdk-ninja-region-compute");
      expect(events[0].payload).toHaveProperty("branch", "release/11.0.0");
      expect(events[0].payload).toHaveProperty("releaseKey", "11.0.0");
    });

    it("should emit release events for successful deploy jobs (e.g., Deploy ca-StackName)", async () => {
      process.env.CIRCLECI_API_TOKEN = "cci-token";
      process.env.CIRCLECI_PROJECT_SLUG = "bb/ninjarmm/cdk-ninja-region-compute";
      process.env.CIRCLECI_RELEASE_BRANCH_REGEX = "^release";
      process.env.CIRCLECI_DEPLOY_WORKFLOW_REGEX = "deploy";
      process.env.CIRCLECI_DEPLOY_JOB_REGEX = "^Deploy\\s";

      const now = new Date();
      const createdAt = now.toISOString();
      const stoppedAt = now.toISOString();

      mockFetch
        // pipelines
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(
            `{"items":[{"id":"p2","created_at":"${createdAt}","state":"created","vcs":{"branch":"release/11.0.0","revision":"abc"}}],"next_page_token":null}`
          ),
        })
        // workflows
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            items: [
              {
                id: "w2",
                name: "deploy-prod",
                status: "success",
                created_at: createdAt,
                stopped_at: stoppedAt,
              },
            ],
          }),
        })
        // jobs for workflow
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            items: [
              { name: "Deploy ca-DbMonitorStack", status: "success", started_at: createdAt, stopped_at: stoppedAt },
              { name: "hold", status: "success", started_at: createdAt, stopped_at: stoppedAt },
            ],
          }),
        });

      const client = new CircleCIClient();
      const events = await client.fetchRecentActivity({ limit: 5 });

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events.some(e => e.message.includes("Deploy ca-DbMonitorStack"))).toBe(true);
      expect(events[0].source).toBe("circleci");
      expect(events[0].type).toBe("release");
    });

    it("should paginate pipelines until it finds recent release branches", async () => {
      process.env.CIRCLECI_API_TOKEN = "cci-token";
      process.env.CIRCLECI_PROJECT_SLUG = "bb/ninjarmm/cdk-ninja-region-compute";
      process.env.CIRCLECI_RELEASE_BRANCH_REGEX = "^release";
      process.env.CIRCLECI_DEPLOY_WORKFLOW_REGEX = "^deploy-prod$";
      process.env.CIRCLECI_DEPLOY_JOB_REGEX = "^Deploy\\s";

      const now = new Date();
      const createdAt = now.toISOString();

      mockFetch
        // page 1: no release branches, but has next_page_token
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(
            `{"items":[{"id":"p-old","created_at":"${createdAt}","state":"created","vcs":{"branch":"develop","revision":"abc"}}],"next_page_token":"next-1"}`
          ),
        })
        // page 2: has a release branch pipeline
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(
            `{"items":[{"id":"p-release","created_at":"${createdAt}","state":"created","vcs":{"branch":"release/v11.0.0","revision":"def"}}],"next_page_token":null}`
          ),
        })
        // workflows for p-release
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            items: [
              {
                id: "w-release",
                name: "deploy-prod",
                status: "success",
                created_at: createdAt,
                stopped_at: createdAt,
              },
            ],
          }),
        })
        // jobs for workflow
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            items: [
              { name: "Deploy ca-DbMonitorStack", status: "success", started_at: createdAt, stopped_at: createdAt },
            ],
          }),
        });

      const client = new CircleCIClient();
      const events = await client.fetchRecentActivity({ limit: 5 });

      expect(mockFetch).toHaveBeenCalledTimes(4);
      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        "https://circleci.com/api/v2/project/bb/ninjarmm/cdk-ninja-region-compute/pipeline",
        expect.anything()
      );
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        "https://circleci.com/api/v2/project/bb/ninjarmm/cdk-ninja-region-compute/pipeline?page-token=next-1",
        expect.anything()
      );
      expect(events).toHaveLength(1);
      expect(events[0].payload).toHaveProperty("branch", "release/v11.0.0");
      expect(events[0].message).toContain("Deploy ca-DbMonitorStack");
    });

    it("should fall back to workflow-level release event when deploy job names don't match", async () => {
      process.env.CIRCLECI_API_TOKEN = "cci-token";
      process.env.CIRCLECI_PROJECT_SLUG = "bb/ninjarmm/cdk-ninja-region-compute";
      process.env.CIRCLECI_RELEASE_BRANCH_REGEX = "^release";
      process.env.CIRCLECI_DEPLOY_WORKFLOW_REGEX = "^deploy-prod$";
      process.env.CIRCLECI_DEPLOY_JOB_REGEX = "^Deploy\\s";

      const now = new Date();
      const createdAt = now.toISOString();

      mockFetch
        // pipelines
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(
            `{"items":[{"id":"p3","created_at":"${createdAt}","state":"created","vcs":{"branch":"release/v11.0.0","revision":"abc"}}],"next_page_token":null}`
          ),
        })
        // workflows
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            items: [
              {
                id: "w3",
                name: "deploy-prod",
                status: "success",
                created_at: createdAt,
                stopped_at: createdAt,
              },
            ],
          }),
        })
        // jobs (note: base name "deploy" won't match ^Deploy\s)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            items: [
              { name: "deploy", status: "success", started_at: createdAt, stopped_at: createdAt },
            ],
          }),
        });

      const client = new CircleCIClient();
      const events = await client.fetchRecentActivity({ limit: 5 });

      expect(events).toHaveLength(1);
      expect(events[0].message).toContain("deploy-prod");
      expect(events[0].payload).toHaveProperty("jobMatchMode", "workflow_fallback");
    });

    it("should emit release events for ansible_playbook_prod workflows (workflow fallback)", async () => {
      process.env.CIRCLECI_API_TOKEN = "cci-token";
      process.env.CIRCLECI_PROJECT_SLUG = "bb/ninjarmm/cdk-ninja-region-compute";
      process.env.CIRCLECI_RELEASE_BRANCH_REGEX = "^release";
      process.env.CIRCLECI_DEPLOY_WORKFLOW_REGEX = "(deploy|ansible_playbook_prod)";
      process.env.CIRCLECI_DEPLOY_JOB_REGEX = "^Deploy\\s";

      const scenario = CircleCITestScenarios.ansiblePlaybookProd;
      const pipelinePage = createMockPipelinePage([scenario.pipeline]);
      const workflowPage = createMockWorkflowPage(scenario.workflows);
      const jobPage = createMockJobPage(scenario.jobs);

      mockFetch
        // pipelines
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(JSON.stringify(pipelinePage)),
        })
        // workflows
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(workflowPage),
        })
        // jobs (no deploy jobs match, so workflow fallback)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(jobPage),
        });

      const client = new CircleCIClient();
      const events = await client.fetchRecentActivity({ limit: 5 });

      expect(events).toHaveLength(1);
      expect(events[0].message).toContain("ansible_playbook_prod");
      expect(events[0].payload).toHaveProperty("jobMatchMode", "workflow_fallback");
      expect(events[0].payload).toHaveProperty("workflowName", "ansible_playbook_prod");
      expect(events[0].payload).toHaveProperty("pipelineNumber", scenario.pipeline.number);
    });

    it("should emit release events for both deploy-prod and ansible_playbook_prod workflows in same pipeline", async () => {
      process.env.CIRCLECI_API_TOKEN = "cci-token";
      process.env.CIRCLECI_PROJECT_SLUG = "bb/ninjarmm/cdk-ninja-region-compute";
      process.env.CIRCLECI_RELEASE_BRANCH_REGEX = "^release";
      process.env.CIRCLECI_DEPLOY_WORKFLOW_REGEX = "(deploy|ansible_playbook_prod)";
      process.env.CIRCLECI_DEPLOY_JOB_REGEX = "^Deploy\\s";

      const scenario = CircleCITestScenarios.bothWorkflows;
      const pipelinePage = createMockPipelinePage([scenario.pipeline]);
      const workflowPage = createMockWorkflowPage(scenario.workflows);

      mockFetch
        // pipelines
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(JSON.stringify(pipelinePage)),
        })
        // workflows (both deploy-prod and ansible_playbook_prod)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(workflowPage),
        })
        // jobs for deploy-prod workflow
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(createMockJobPage(scenario.jobs["w4a"])),
        })
        // jobs for ansible_playbook_prod workflow
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(createMockJobPage(scenario.jobs["w4b"])),
        });

      const client = new CircleCIClient();
      const events = await client.fetchRecentActivity({ limit: 10 });

      // Should have 2 events: one job-level from deploy-prod, one workflow-level from ansible_playbook_prod
      expect(events.length).toBeGreaterThanOrEqual(2);
      
      const deployProdEvent = events.find(e => 
        (e.payload as any).workflowName === "deploy-prod" && 
        (e.payload as any).jobName
      );
      const ansibleEvent = events.find(e => 
        (e.payload as any).workflowName === "ansible_playbook_prod" &&
        (e.payload as any).jobMatchMode === "workflow_fallback"
      );

      expect(deployProdEvent).toBeDefined();
      expect(ansibleEvent).toBeDefined();
      // job-level events don't have jobMatchMode property
      expect(deployProdEvent?.payload).not.toHaveProperty("jobMatchMode");
      expect(ansibleEvent?.payload).toHaveProperty("jobMatchMode", "workflow_fallback");
    });

    it("should emit multiple events for multiple ring deployments", async () => {
      process.env.CIRCLECI_API_TOKEN = "cci-token";
      process.env.CIRCLECI_PROJECT_SLUG = "bb/ninjarmm/cdk-ninja-region-compute";
      process.env.CIRCLECI_RELEASE_BRANCH_REGEX = "^release";
      process.env.CIRCLECI_DEPLOY_WORKFLOW_REGEX = "deploy";
      process.env.CIRCLECI_DEPLOY_JOB_REGEX = "^Deploy\\s";

      const scenario = CircleCITestScenarios.multipleRings;
      const pipelinePage = createMockPipelinePage([scenario.pipeline]);
      const workflowPage = createMockWorkflowPage(scenario.workflows);
      const jobPage = createMockJobPage(scenario.jobs);

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(JSON.stringify(pipelinePage)),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(workflowPage),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(jobPage),
        });

      const client = new CircleCIClient();
      const events = await client.fetchRecentActivity({ limit: 10 });

      // Should have 3 events: one per ring (CA, OC, EU)
      expect(events).toHaveLength(3);
      expect(events.some(e => (e.payload as any).jobName?.includes("ca-"))).toBe(true);
      expect(events.some(e => (e.payload as any).jobName?.includes("oc-"))).toBe(true);
      expect(events.some(e => (e.payload as any).jobName?.includes("eu-"))).toBe(true);
    });

    it("should emit failure events for terminal failed deploy workflows", async () => {
      process.env.CIRCLECI_API_TOKEN = "cci-token";
      process.env.CIRCLECI_PROJECT_SLUG = "bb/ninjarmm/cdk-ninja-region-compute";
      process.env.CIRCLECI_RELEASE_BRANCH_REGEX = "^release";
      process.env.CIRCLECI_DEPLOY_WORKFLOW_REGEX = "deploy";
      process.env.CIRCLECI_DEPLOY_JOB_REGEX = ".*";

      const scenario = CircleCITestScenarios.failedDeployProd;
      const pipelinePage = createMockPipelinePage([scenario.pipeline]);
      const workflowPage = createMockWorkflowPage(scenario.workflows);
      const jobPage = createMockJobPage(scenario.jobs);

      mockFetch
        // pipelines
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(JSON.stringify(pipelinePage)),
        })
        // workflows (failed with stopped_at)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(workflowPage),
        })
        // jobs
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(jobPage),
        });

      const client = new CircleCIClient();
      const events = await client.fetchRecentActivity({ limit: 5 });

      expect(events).toHaveLength(1);
      expect(events[0].payload).toHaveProperty("failed", true);
      expect(events[0].message).toContain("failed");
    });

    it("should NOT emit events for in-progress workflows (no stopped_at)", async () => {
      process.env.CIRCLECI_API_TOKEN = "cci-token";
      process.env.CIRCLECI_PROJECT_SLUG = "bb/ninjarmm/cdk-ninja-region-compute";
      process.env.CIRCLECI_RELEASE_BRANCH_REGEX = "^release";
      process.env.CIRCLECI_DEPLOY_WORKFLOW_REGEX = "deploy";
      process.env.CIRCLECI_DEPLOY_JOB_REGEX = ".*";

      const now = new Date().toISOString();
      const runningWorkflow = createMockWorkflow({
        id: "w-running",
        name: "deploy-prod",
        status: "running",
        stopped_at: undefined, // No stopped_at = in progress (use undefined, not null)
      });
      const pipelinePage = createMockPipelinePage([
        createMockPipeline({
          id: "p-running",
          vcs: { branch: "release/v11.0.0", revision: "abc" },
        }),
      ]);
      const workflowPage = createMockWorkflowPage([runningWorkflow]);

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(JSON.stringify(pipelinePage)),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(workflowPage),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(createMockJobPage([])),
        });

      const client = new CircleCIClient();
      const events = await client.fetchRecentActivity({ limit: 5 });

      // Should not emit event for running workflow (no stopped_at)
      expect(events).toHaveLength(0);
    });

    it("should emit multiple events for multiple ring deployments", async () => {
      process.env.CIRCLECI_API_TOKEN = "cci-token";
      process.env.CIRCLECI_PROJECT_SLUG = "bb/ninjarmm/cdk-ninja-region-compute";
      process.env.CIRCLECI_RELEASE_BRANCH_REGEX = "^release";
      process.env.CIRCLECI_DEPLOY_WORKFLOW_REGEX = "deploy";
      process.env.CIRCLECI_DEPLOY_JOB_REGEX = "^Deploy\\s";

      const scenario = CircleCITestScenarios.multipleRings;
      const pipelinePage = createMockPipelinePage([scenario.pipeline]);
      const workflowPage = createMockWorkflowPage(scenario.workflows);
      const jobPage = createMockJobPage(scenario.jobs);

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(JSON.stringify(pipelinePage)),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(workflowPage),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(jobPage),
        });

      const client = new CircleCIClient();
      const events = await client.fetchRecentActivity({ limit: 10 });

      // Should have 3 events: one per ring (CA, OC, EU)
      expect(events).toHaveLength(3);
      expect(events.some(e => (e.payload as any).jobName?.includes("ca-"))).toBe(true);
      expect(events.some(e => (e.payload as any).jobName?.includes("oc-"))).toBe(true);
      expect(events.some(e => (e.payload as any).jobName?.includes("eu-"))).toBe(true);
    });

    it("should handle failed workflows", async () => {
      process.env.CIRCLECI_API_TOKEN = "cci-token";
      process.env.CIRCLECI_PROJECT_SLUG = "bb/ninjarmm/cdk-ninja-region-compute";
      process.env.CIRCLECI_RELEASE_BRANCH_REGEX = "^release";
      process.env.CIRCLECI_DEPLOY_WORKFLOW_REGEX = "deploy";
      process.env.CIRCLECI_DEPLOY_JOB_REGEX = "^Deploy\\s";

      const createdAt = new Date().toISOString();
      const stoppedAt = new Date().toISOString();

      const failedWorkflow = createMockWorkflow({
        id: "w-fail",
        name: "deploy-ca",
        status: "failed",
        stopped_at: stoppedAt,
      });
      const pipelinePage = createMockPipelinePage([
        createMockPipeline({
          id: "p-fail",
          vcs: { branch: "release/v11.0.0", revision: "abc" },
        }),
      ]);
      const workflowPage = createMockWorkflowPage([failedWorkflow]);

      mockFetch
        // pipelines
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(JSON.stringify(pipelinePage)),
        })
        // workflows
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(workflowPage),
        })
        // jobs (no matching deploy jobs, so workflow fallback)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            items: [
              { name: "build", status: "success", started_at: createdAt, stopped_at: stoppedAt },
            ],
          }),
        });

      const client = new CircleCIClient();
      const events = await client.fetchRecentActivity({ limit: 5 });

      expect(events).toHaveLength(1);
      expect(events[0].source).toBe("circleci");
      expect(events[0].type).toBe("release");
      expect(events[0].message).toContain("failed");
      expect(events[0].payload).toHaveProperty("failed", true);
      expect(events[0].payload).toHaveProperty("workflowStatus", "failed");
      expect(events[0].payload).toHaveProperty("jobMatchMode", "workflow_fallback");
    });

    it("should emit failure events for terminal failed deploy jobs", async () => {
      process.env.CIRCLECI_API_TOKEN = "cci-token";
      process.env.CIRCLECI_PROJECT_SLUG = "bb/ninjarmm/cdk-ninja-region-compute";
      process.env.CIRCLECI_RELEASE_BRANCH_REGEX = "^release";
      process.env.CIRCLECI_DEPLOY_WORKFLOW_REGEX = "deploy";
      process.env.CIRCLECI_DEPLOY_JOB_REGEX = "^Deploy\\s";

      const now = new Date();
      const createdAt = now.toISOString();
      const stoppedAt = now.toISOString();

      mockFetch
        // pipelines
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(
            `{"items":[{"id":"p-fail2","created_at":"${createdAt}","state":"created","vcs":{"branch":"release/11.0.0","revision":"abc"}}],"next_page_token":null}`
          ),
        })
        // workflows (success)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            items: [
              {
                id: "w-fail2",
                name: "deploy-prod",
                status: "success",
                created_at: createdAt,
                stopped_at: stoppedAt,
              },
            ],
          }),
        })
        // jobs (failed deploy job with stopped_at)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            items: [
              { name: "Deploy ca-Stack", status: "failed", started_at: createdAt, stopped_at: stoppedAt },
            ],
          }),
        });

      const client = new CircleCIClient();
      const events = await client.fetchRecentActivity({ limit: 5 });

      expect(events).toHaveLength(1);
      expect(events[0].source).toBe("circleci");
      expect(events[0].type).toBe("release");
      expect(events[0].message).toContain("failed");
      expect(events[0].payload).toHaveProperty("failed", true);
      expect(events[0].payload).toHaveProperty("jobStatus", "failed");
    });

    it("should not emit failure events for in-progress workflows without stopped_at", async () => {
      process.env.CIRCLECI_API_TOKEN = "cci-token";
      process.env.CIRCLECI_PROJECT_SLUG = "bb/ninjarmm/cdk-ninja-region-compute";
      process.env.CIRCLECI_RELEASE_BRANCH_REGEX = "^release";
      process.env.CIRCLECI_DEPLOY_WORKFLOW_REGEX = "deploy";
      process.env.CIRCLECI_DEPLOY_JOB_REGEX = ".*";

      const now = new Date();
      const createdAt = now.toISOString();

      mockFetch
        // pipelines
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(
            `{"items":[{"id":"p-running","created_at":"${createdAt}","state":"created","vcs":{"branch":"release/11.0.0","revision":"abc"}}],"next_page_token":null}`
          ),
        })
        // workflows (failed but no stopped_at - in progress)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            items: [
              {
                id: "w-running",
                name: "deploy-ca",
                status: "failed",
                created_at: createdAt,
                stopped_at: undefined,
              },
            ],
          }),
        })
        // jobs
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            items: [],
          }),
        });

      const client = new CircleCIClient();
      const events = await client.fetchRecentActivity({ limit: 5 });

      // Should not emit in-progress failures (no stopped_at)
      expect(events).toHaveLength(0);
    });
  });
});

describe("createServiceClients", () => {
  it("should create clients for all 6 sources", () => {
    const clients = createServiceClients();
    
    expect(clients.slack).toBeInstanceOf(SlackClient);
    expect(clients.gitlab).toBeInstanceOf(GitLabClient);
    expect(clients.bitbucket).toBeInstanceOf(BitbucketClient);
    expect(clients.jira).toBeInstanceOf(JiraClient);
    expect(clients.pagerduty).toBeInstanceOf(PagerDutyClient);
    expect(clients.circleci).toBeInstanceOf(CircleCIClient);
  });
});

describe("getConfiguredClients", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    // Purpose: tests must be deterministic even when developers have real integrations
    // configured in their local shell env / .env.
    delete process.env.BITBUCKET_USERNAME;
    delete process.env.BITBUCKET_APP_PASSWORD;
    delete process.env.BITBUCKET_API_TOKEN;
    delete process.env.BITBUCKET_WORKSPACE;
    delete process.env.JIRA_HOST;
    delete process.env.JIRA_EMAIL;
    delete process.env.JIRA_API_TOKEN;
    delete process.env.PAGERDUTY_API_KEY;
    delete process.env.CIRCLECI_API_TOKEN;
    delete process.env.CIRCLECI_PROJECT_SLUG;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should return empty array when no clients are configured", () => {
    delete process.env.SLACK_BOT_TOKEN;
    delete process.env.GITLAB_TOKEN;
    delete process.env.BITBUCKET_USERNAME;
    delete process.env.BITBUCKET_APP_PASSWORD;
    delete process.env.BITBUCKET_API_TOKEN;
    delete process.env.BITBUCKET_WORKSPACE;
    delete process.env.JIRA_HOST;
    delete process.env.PAGERDUTY_API_KEY;
    delete process.env.CIRCLECI_API_TOKEN;
    
    const clients = getConfiguredClients();
    expect(clients).toHaveLength(0);
  });

  it("should return only configured clients", () => {
    process.env.SLACK_BOT_TOKEN = "test-token";
    process.env.GITLAB_TOKEN = "gitlab-token";
    delete process.env.BITBUCKET_USERNAME;
    delete process.env.BITBUCKET_APP_PASSWORD;
    delete process.env.BITBUCKET_API_TOKEN;
    delete process.env.BITBUCKET_WORKSPACE;
    delete process.env.JIRA_HOST;
    delete process.env.PAGERDUTY_API_KEY;
    
    const clients = getConfiguredClients();
    expect(clients).toHaveLength(2);
    expect(clients.map(c => c.source)).toContain("slack");
    expect(clients.map(c => c.source)).toContain("gitlab");
  });
});
