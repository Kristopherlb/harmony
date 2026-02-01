import { describe, it, expect } from "vitest";
import {
  SlackAdapter,
  GitLabAdapter,
  BitbucketAdapter,
  JiraAdapter,
  PagerDutyAdapter,
  getAdapter,
} from "./adapters";
import type { SlackCommand } from "@shared/schema";

describe("SlackAdapter", () => {
  const adapter = new SlackAdapter();

  describe("source", () => {
    it("should have source set to slack", () => {
      expect(adapter.source).toBe("slack");
    });
  });

  describe("transformToEvent", () => {
    const baseSlackCommand: SlackCommand = {
      command: "/ops",
      text: "log Test message",
      user_id: "U12345",
      user_name: "testuser",
      channel_id: "C67890",
      channel_name: "ops-channel",
    };

    it("should transform log command to log event with low severity", () => {
      const event = adapter.transformToEvent(baseSlackCommand);

      expect(event.source).toBe("slack");
      expect(event.type).toBe("log");
      expect(event.severity).toBe("low");
      expect(event.message).toBe("Test message");
      expect(event.userId).toBe("U12345");
      expect(event.username).toBe("testuser");
    });

    it("should transform blocker command to blocker event with high severity", () => {
      const command: SlackCommand = {
        ...baseSlackCommand,
        text: "blocker Database is down",
      };

      const event = adapter.transformToEvent(command);

      expect(event.type).toBe("blocker");
      expect(event.severity).toBe("high");
      expect(event.message).toBe("Database is down");
    });

    it("should transform decision command to decision event with medium severity", () => {
      const command: SlackCommand = {
        ...baseSlackCommand,
        text: "decision ADR-001: Use GraphQL",
      };

      const event = adapter.transformToEvent(command);

      expect(event.type).toBe("decision");
      expect(event.severity).toBe("medium");
      expect(event.message).toBe("ADR-001: Use GraphQL");
    });

    it("should transform status command to log event", () => {
      const command: SlackCommand = {
        ...baseSlackCommand,
        text: "status",
      };

      const event = adapter.transformToEvent(command);

      expect(event.type).toBe("log");
      expect(event.severity).toBe("low");
    });

    it("should default to log when no command recognized", () => {
      const command: SlackCommand = {
        ...baseSlackCommand,
        text: "unknown Some text here",
      };

      const event = adapter.transformToEvent(command);

      expect(event.type).toBe("log");
      expect(event.severity).toBe("low");
    });

    it("should include channel info in payload", () => {
      const event = adapter.transformToEvent(baseSlackCommand);

      expect(event.payload).toHaveProperty("channel_id", "C67890");
      expect(event.payload).toHaveProperty("channel_name", "ops-channel");
    });

    it("should set resolved to false by default", () => {
      const event = adapter.transformToEvent(baseSlackCommand);

      expect(event.resolved).toBe(false);
    });

    it("should set timestamp to current time", () => {
      const before = new Date().getTime();
      const event = adapter.transformToEvent(baseSlackCommand);
      const after = new Date().getTime();

      const eventTime = new Date(event.timestamp).getTime();
      expect(eventTime).toBeGreaterThanOrEqual(before);
      expect(eventTime).toBeLessThanOrEqual(after);
    });
  });

  describe("createBlockKitResponse", () => {
    it("should create Block Kit formatted response", () => {
      const event = adapter.transformToEvent({
        command: "/ops",
        text: "log Test message",
        user_id: "U12345",
        user_name: "testuser",
        channel_id: "C67890",
        channel_name: "ops-channel",
      });

      const response = adapter.createBlockKitResponse(event);

      expect(response).toHaveProperty("response_type", "in_channel");
      expect(response).toHaveProperty("blocks");
      expect(Array.isArray((response as { blocks: unknown[] }).blocks)).toBe(true);
    });
  });
});

describe("GitLabAdapter", () => {
  const adapter = new GitLabAdapter();

  describe("source", () => {
    it("should have source set to gitlab", () => {
      expect(adapter.source).toBe("gitlab");
    });
  });

  describe("transformToEvent", () => {
    it("should transform push event to release type with lead time", () => {
      const payload = {
        object_kind: "push",
        ref: "refs/heads/main",
        user_name: "developer",
        user_id: "123",
        commits: [{ message: "Fix bug" }, { message: "Update readme" }],
      };

      const event = adapter.transformToEvent(payload);

      expect(event.source).toBe("gitlab");
      expect(event.type).toBe("release");
      expect(event.severity).toBe("medium");
      expect(event.message).toContain("2 commit(s)");
      expect((event.payload as { leadTimeHours: number }).leadTimeHours).toBeGreaterThanOrEqual(4);
    });

    it("should transform merge_request event to log type", () => {
      const payload = {
        object_kind: "merge_request",
        project: { name: "my-project" },
        user_name: "developer",
      };

      const event = adapter.transformToEvent(payload);

      expect(event.type).toBe("log");
      expect(event.message).toContain("Merge request");
    });

    it("should transform pipeline event to log type", () => {
      const payload = {
        object_kind: "pipeline",
        project: { name: "ci-project" },
        user_name: "developer",
      };

      const event = adapter.transformToEvent(payload);

      expect(event.type).toBe("log");
      expect(event.message).toContain("Pipeline triggered");
      expect(event.message).toContain("ci-project");
    });

    it("should handle missing fields gracefully", () => {
      const payload = { object_kind: "unknown" };

      const event = adapter.transformToEvent(payload);

      expect(event.source).toBe("gitlab");
      expect(event.type).toBe("log");
      expect(event.message).toContain("GitLab");
    });
  });
});

describe("BitbucketAdapter", () => {
  const adapter = new BitbucketAdapter();

  describe("source", () => {
    it("should have source set to bitbucket", () => {
      expect(adapter.source).toBe("bitbucket");
    });
  });

  describe("transformToEvent", () => {
    it("should transform push webhook to release event with lead time", () => {
      const payload = {
        push: {
          changes: [{ new: { name: "feature-branch" } }],
        },
        actor: { display_name: "Dev User", uuid: "user-123" },
        repository: { name: "my-repo" },
      };

      const event = adapter.transformToEvent(payload);

      expect(event.source).toBe("bitbucket");
      expect(event.type).toBe("release");
      expect(event.message).toContain("feature-branch");
      expect(event.username).toBe("Dev User");
      expect((event.payload as { leadTimeHours: number }).leadTimeHours).toBeGreaterThanOrEqual(4);
    });
  });
});

describe("JiraAdapter", () => {
  const adapter = new JiraAdapter();

  describe("source", () => {
    it("should have source set to jira", () => {
      expect(adapter.source).toBe("jira");
    });
  });

  describe("transformToEvent", () => {
    it("should transform issue update to log event", () => {
      const payload = {
        webhookEvent: "jira:issue_updated",
        issue: {
          key: "PROJ-123",
          fields: {
            summary: "Fix login bug",
            priority: { name: "Medium" },
          },
        },
        user: { displayName: "John Doe", accountId: "abc123" },
      };

      const event = adapter.transformToEvent(payload);

      expect(event.source).toBe("jira");
      expect(event.type).toBe("log");
      expect(event.message).toContain("PROJ-123");
      expect(event.message).toContain("Fix login bug");
    });

    it("should mark highest priority issues as blockers", () => {
      const payload = {
        webhookEvent: "jira:issue_updated",
        issue: {
          key: "PROJ-999",
          fields: {
            summary: "Critical production issue",
            priority: { name: "Highest" },
          },
        },
      };

      const event = adapter.transformToEvent(payload);

      expect(event.type).toBe("blocker");
      expect(event.severity).toBe("high");
    });

    it("should transform issue_created to log event", () => {
      const payload = {
        webhookEvent: "jira:issue_created",
        issue: {
          key: "PROJ-456",
          fields: {
            summary: "New feature request",
            priority: { name: "Medium" },
          },
        },
        user: { displayName: "Jane Doe", accountId: "xyz789" },
      };

      const event = adapter.transformToEvent(payload);

      expect(event.source).toBe("jira");
      expect(event.type).toBe("log");
      expect(event.message).toContain("PROJ-456");
    });

    it("should mark blocker priority issues as blockers", () => {
      const payload = {
        webhookEvent: "jira:issue_updated",
        issue: {
          key: "PROJ-888",
          fields: {
            summary: "Blocker issue",
            priority: { name: "Blocker" },
          },
        },
      };

      const event = adapter.transformToEvent(payload);

      expect(event.type).toBe("blocker");
      expect(event.severity).toBe("high");
    });
  });
});

describe("PagerDutyAdapter", () => {
  const adapter = new PagerDutyAdapter();

  describe("source", () => {
    it("should have source set to pagerduty", () => {
      expect(adapter.source).toBe("pagerduty");
    });
  });

  describe("transformToEvent", () => {
    it("should transform incident triggered to critical alert", () => {
      const payload = {
        event: {
          event_type: "incident.triggered",
          data: {
            title: "Server down",
            urgency: "high",
            assignees: [{ summary: "On-call Engineer", id: "P123" }],
          },
        },
      };

      const event = adapter.transformToEvent(payload);

      expect(event.source).toBe("pagerduty");
      expect(event.type).toBe("alert");
      expect(event.severity).toBe("critical");
      expect(event.message).toBe("Server down");
      expect(event.resolved).toBe(false);
    });

    it("should mark resolved incidents as resolved", () => {
      const payload = {
        event: {
          event_type: "incident.resolved",
          data: {
            title: "Server restored",
            urgency: "high",
          },
        },
      };

      const event = adapter.transformToEvent(payload);

      expect(event.resolved).toBe(true);
      expect(event.resolvedAt).toBeDefined();
      expect(event.severity).toBe("low");
    });

    it("should set acknowledged incidents to medium severity", () => {
      const payload = {
        event: {
          event_type: "incident.acknowledged",
          data: {
            title: "Looking into it",
            urgency: "low",
          },
        },
      };

      const event = adapter.transformToEvent(payload);

      expect(event.severity).toBe("medium");
      expect(event.resolved).toBe(false);
    });
  });
});

describe("getAdapter factory", () => {
  it("should return SlackAdapter for slack source", () => {
    const adapter = getAdapter("slack");
    expect(adapter.source).toBe("slack");
  });

  it("should return GitLabAdapter for gitlab source", () => {
    const adapter = getAdapter("gitlab");
    expect(adapter.source).toBe("gitlab");
  });

  it("should return correct adapter for all sources", () => {
    const sources = ["slack", "gitlab", "bitbucket", "jira", "pagerduty"] as const;
    
    sources.forEach((source) => {
      const adapter = getAdapter(source);
      expect(adapter.source).toBe(source);
    });
  });
});
