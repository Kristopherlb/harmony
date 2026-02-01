import { describe, it, expect, beforeEach } from "vitest";
import {
  SeedableMemoryRepository,
  createRepository,
  generateSeedData,
  type InitialData,
} from "./storage";
import type { Event, InsertEvent, Project } from "@shared/schema";
import { GetUserStats } from "./metrics/application/get-user-stats";
import { EventRepositoryAdapter } from "./events/adapters/event-repository-adapter";

describe("SeedableMemoryRepository", () => {
  describe("constructor and dependency injection", () => {
    it("should create empty repository when no initial data provided", async () => {
      const repo = new SeedableMemoryRepository();
      const { events, total } = await repo.getEvents();
      
      expect(events).toEqual([]);
      expect(total).toBe(0);
    });

    it("should seed repository with provided initial data", async () => {
      const initialEvents: Event[] = [
        {
          id: "test-event-1",
          timestamp: "2026-01-01T10:00:00.000Z",
          source: "slack",
          type: "log",
          severity: "low",
          message: "Test log message",
          payload: {},
          resolved: false,
        },
        {
          id: "test-event-2",
          timestamp: "2026-01-02T10:00:00.000Z",
          source: "gitlab",
          type: "release",
          severity: "medium",
          message: "v1.0.0 deployed",
          payload: { leadTimeHours: 12 },
          resolved: false,
        },
      ];

      const repo = new SeedableMemoryRepository({ events: initialEvents });
      const { events, total } = await repo.getEvents();

      expect(total).toBe(2);
      expect(events).toHaveLength(2);
    });

    it("should seed projects when provided", async () => {
      const initialProjects: Project[] = [
        {
          id: "project-1",
          name: "Test Project",
          status: "active",
          repositoryUrl: "https://github.com/test/repo",
        },
      ];

      const repo = new SeedableMemoryRepository({ projects: initialProjects });
      const projects = await repo.getProjects();

      expect(projects).toHaveLength(1);
      expect(projects[0].name).toBe("Test Project");
    });
  });

  describe("getEvents", () => {
    let repo: SeedableMemoryRepository;
    const testEvents: Event[] = Array.from({ length: 75 }, (_, i) => ({
      id: `event-${i}`,
      timestamp: new Date(Date.now() - i * 60000).toISOString(),
      source: "slack" as const,
      type: "log" as const,
      severity: "low" as const,
      message: `Event ${i}`,
      payload: {},
      resolved: false,
    }));

    beforeEach(() => {
      repo = new SeedableMemoryRepository({ events: testEvents });
    });

    it("should return paginated events with default page size 50", async () => {
      const { events, total } = await repo.getEvents();

      expect(events).toHaveLength(50);
      expect(total).toBe(75);
    });

    it("should return events sorted by timestamp descending", async () => {
      const { events } = await repo.getEvents();

      for (let i = 1; i < events.length; i++) {
        const current = new Date(events[i].timestamp).getTime();
        const previous = new Date(events[i - 1].timestamp).getTime();
        expect(previous).toBeGreaterThanOrEqual(current);
      }
    });

    it("should support custom page size", async () => {
      const { events, total } = await repo.getEvents({ pageSize: 10 });

      expect(events).toHaveLength(10);
      expect(total).toBe(75);
    });

    it("should support pagination", async () => {
      const page1 = await repo.getEvents({ page: 1, pageSize: 10 });
      const page2 = await repo.getEvents({ page: 2, pageSize: 10 });

      expect(page1.events).toHaveLength(10);
      expect(page2.events).toHaveLength(10);
      expect(page1.events[0].id).not.toBe(page2.events[0].id);
    });
  });

  describe("createEvent", () => {
    it("should create event with generated UUID", async () => {
      const repo = new SeedableMemoryRepository();
      const insertEvent: InsertEvent = {
        timestamp: new Date().toISOString(),
        source: "slack",
        type: "log",
        severity: "low",
        message: "New event",
        payload: {},
        resolved: false,
      };

      const created = await repo.createEvent(insertEvent);

      expect(created.id).toBeDefined();
      expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(created.message).toBe("New event");
    });

    it("should persist created event", async () => {
      const repo = new SeedableMemoryRepository();
      const insertEvent: InsertEvent = {
        timestamp: new Date().toISOString(),
        source: "jira",
        type: "blocker",
        severity: "high",
        message: "Critical issue",
        payload: {},
        resolved: false,
      };

      const created = await repo.createEvent(insertEvent);
      const retrieved = await repo.getEventById(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.message).toBe("Critical issue");
    });
  });

  describe("getEventsBySource", () => {
    it("should filter events by source", async () => {
      const events: Event[] = [
        { id: "1", timestamp: new Date().toISOString(), source: "slack", type: "log", severity: "low", message: "Slack msg", payload: {}, resolved: false },
        { id: "2", timestamp: new Date().toISOString(), source: "gitlab", type: "log", severity: "low", message: "GitLab msg", payload: {}, resolved: false },
        { id: "3", timestamp: new Date().toISOString(), source: "slack", type: "log", severity: "low", message: "Another Slack", payload: {}, resolved: false },
      ];

      const repo = new SeedableMemoryRepository({ events });
      const slackEvents = await repo.getEventsBySource("slack");

      expect(slackEvents).toHaveLength(2);
      expect(slackEvents.every((e) => e.source === "slack")).toBe(true);
    });
  });

  describe("getEventsByUser", () => {
    it("should filter events by userId", async () => {
      const events: Event[] = [
        { id: "1", timestamp: new Date().toISOString(), source: "slack", type: "log", severity: "low", message: "Msg 1", payload: {}, userId: "U001", resolved: false },
        { id: "2", timestamp: new Date().toISOString(), source: "slack", type: "log", severity: "low", message: "Msg 2", payload: {}, userId: "U002", resolved: false },
        { id: "3", timestamp: new Date().toISOString(), source: "slack", type: "log", severity: "low", message: "Msg 3", payload: {}, userId: "U001", resolved: false },
      ];

      const repo = new SeedableMemoryRepository({ events });
      const userEvents = await repo.getEventsByUser("U001");

      expect(userEvents).toHaveLength(2);
      expect(userEvents.every((e) => e.userId === "U001")).toBe(true);
    });
  });

  describe("resolveBlocker", () => {
    it("should mark blocker as resolved with timestamp", async () => {
      const events: Event[] = [
        { id: "blocker-1", timestamp: new Date().toISOString(), source: "slack", type: "blocker", severity: "high", message: "Critical bug", payload: {}, resolved: false },
      ];

      const repo = new SeedableMemoryRepository({ events });
      const resolved = await repo.resolveBlocker("blocker-1");

      expect(resolved).toBeDefined();
      expect(resolved?.resolved).toBe(true);
      expect(resolved?.resolvedAt).toBeDefined();
    });

    it("should return undefined for non-blocker events", async () => {
      const events: Event[] = [
        { id: "log-1", timestamp: new Date().toISOString(), source: "slack", type: "log", severity: "low", message: "Regular log", payload: {}, resolved: false },
      ];

      const repo = new SeedableMemoryRepository({ events });
      const result = await repo.resolveBlocker("log-1");

      expect(result).toBeUndefined();
    });

    it("should return undefined for non-existent event", async () => {
      const repo = new SeedableMemoryRepository();
      const result = await repo.resolveBlocker("non-existent");

      expect(result).toBeUndefined();
    });
  });

  describe("getUserStats", () => {
    it("should calculate user statistics correctly", async () => {
      const now = new Date();
      const events: Event[] = [
        { id: "1", timestamp: now.toISOString(), source: "slack", type: "log", severity: "low", message: "Log 1", payload: {}, userId: "U001", username: "alice", resolved: false },
        { id: "2", timestamp: now.toISOString(), source: "slack", type: "blocker", severity: "high", message: "Blocker", payload: {}, userId: "U001", username: "alice", resolved: true },
        { id: "3", timestamp: now.toISOString(), source: "slack", type: "decision", severity: "medium", message: "ADR", payload: {}, userId: "U001", username: "alice", resolved: false },
      ];

      const repo = new SeedableMemoryRepository({ events });
      const eventRepository = new EventRepositoryAdapter(repo);
      const getUserStats = new GetUserStats(eventRepository);
      const stats = await getUserStats.execute({ userId: "U001" });

      expect(stats.userId).toBe("U001");
      expect(stats.username).toBe("alice");
      expect(stats.logsThisWeek).toBe(1);
      expect(stats.blockersResolved).toBe(1);
      expect(stats.decisionsLogged).toBe(1);
      expect(stats.totalEvents).toBe(3);
    });
  });
});

describe("generateSeedData", () => {
  it("should generate events array", () => {
    const data = generateSeedData();

    expect(data.events).toBeDefined();
    expect(Array.isArray(data.events)).toBe(true);
    expect(data.events!.length).toBeGreaterThan(0);
  });

  it("should generate projects array", () => {
    const data = generateSeedData();

    expect(data.projects).toBeDefined();
    expect(Array.isArray(data.projects)).toBe(true);
    expect(data.projects!.length).toBeGreaterThan(0);
  });

  it("should generate valid event objects", () => {
    const data = generateSeedData();
    const event = data.events![0];

    expect(event.id).toBeDefined();
    expect(event.timestamp).toBeDefined();
    expect(event.source).toBeDefined();
    expect(event.type).toBeDefined();
    expect(event.severity).toBeDefined();
    expect(event.message).toBeDefined();
  });
});

describe("createRepository factory", () => {
  it("should create repository with default seed data", () => {
    const repo = createRepository();

    expect(repo).toBeInstanceOf(SeedableMemoryRepository);
  });

  it("should create repository with custom initial data", async () => {
    const customData: InitialData = {
      events: [
        { id: "custom-1", timestamp: new Date().toISOString(), source: "slack", type: "log", severity: "low", message: "Custom event", payload: {}, resolved: false },
      ],
    };

    const repo = createRepository(customData);
    const { total } = await repo.getEvents();

    expect(total).toBe(1);
  });
});

describe("Security Repository", () => {
  let repo: SeedableMemoryRepository;

  beforeEach(() => {
    repo = new SeedableMemoryRepository();
  });

  describe("createFinding", () => {
    it("should create a security finding with generated id", async () => {
      const finding = await repo.createFinding({
        severity: "critical",
        tool: "wiz",
        cve: "CVE-2024-1234",
        asset: "api-gateway:latest",
        status: "open",
        title: "Remote Code Execution",
        detectedAt: new Date().toISOString(),
      });

      expect(finding.id).toBeDefined();
      expect(finding.severity).toBe("critical");
      expect(finding.tool).toBe("wiz");
      expect(finding.cve).toBe("CVE-2024-1234");
    });
  });

  describe("getFindings", () => {
    beforeEach(async () => {
      await repo.createFinding({
        severity: "critical",
        tool: "wiz",
        asset: "asset-1",
        status: "open",
        title: "Finding 1",
        detectedAt: "2024-01-15T10:00:00Z",
      });
      await repo.createFinding({
        severity: "high",
        tool: "aws_inspector",
        asset: "asset-2",
        status: "resolved",
        title: "Finding 2",
        detectedAt: "2024-01-16T10:00:00Z",
      });
      await repo.createFinding({
        severity: "medium",
        tool: "artifactory_xray",
        asset: "asset-3",
        status: "open",
        title: "Finding 3",
        detectedAt: "2024-01-17T10:00:00Z",
      });
    });

    it("should return all findings", async () => {
      const { findings, total } = await repo.getFindings();
      expect(total).toBe(3);
      expect(findings).toHaveLength(3);
    });

    it("should filter by tool", async () => {
      const { findings, total } = await repo.getFindings({ tool: "wiz" });
      expect(total).toBe(1);
      expect(findings[0].tool).toBe("wiz");
    });

    it("should filter by severity", async () => {
      const { findings, total } = await repo.getFindings({ severity: "critical" });
      expect(total).toBe(1);
      expect(findings[0].severity).toBe("critical");
    });

    it("should filter by status", async () => {
      const { findings, total } = await repo.getFindings({ status: "open" });
      expect(total).toBe(2);
      findings.forEach(f => expect(f.status).toBe("open"));
    });

    it("should paginate results", async () => {
      const { findings } = await repo.getFindings({ page: 1, pageSize: 2 });
      expect(findings).toHaveLength(2);
    });

    it("should sort by detectedAt descending", async () => {
      const { findings } = await repo.getFindings();
      expect(new Date(findings[0].detectedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(findings[1].detectedAt).getTime()
      );
    });
  });

  describe("getFindingById", () => {
    it("should return finding by id", async () => {
      const created = await repo.createFinding({
        severity: "high",
        tool: "wiz",
        asset: "test-asset",
        status: "open",
        title: "Test Finding",
        detectedAt: new Date().toISOString(),
      });

      const found = await repo.getFindingById(created.id);
      expect(found).toBeDefined();
      expect(found!.id).toBe(created.id);
    });

    it("should return undefined for non-existent id", async () => {
      const found = await repo.getFindingById("non-existent");
      expect(found).toBeUndefined();
    });
  });

  describe("updateFinding", () => {
    it("should update finding fields", async () => {
      const created = await repo.createFinding({
        severity: "high",
        tool: "wiz",
        asset: "test-asset",
        status: "open",
        title: "Test Finding",
        detectedAt: new Date().toISOString(),
      });

      const updated = await repo.updateFinding(created.id, { status: "ignored" });
      expect(updated).toBeDefined();
      expect(updated!.status).toBe("ignored");
    });

    it("should return undefined for non-existent id", async () => {
      const updated = await repo.updateFinding("non-existent", { status: "resolved" });
      expect(updated).toBeUndefined();
    });
  });

  describe("resolveFinding", () => {
    it("should resolve a finding and set resolvedAt", async () => {
      const created = await repo.createFinding({
        severity: "critical",
        tool: "wiz",
        asset: "test-asset",
        status: "open",
        title: "Test Finding",
        detectedAt: new Date().toISOString(),
      });

      const resolved = await repo.resolveFinding(created.id);
      expect(resolved).toBeDefined();
      expect(resolved!.status).toBe("resolved");
      expect(resolved!.resolvedAt).toBeDefined();
    });

    it("should return undefined for non-existent id", async () => {
      const resolved = await repo.resolveFinding("non-existent");
      expect(resolved).toBeUndefined();
    });
  });

  describe("getSecuritySummary", () => {
    beforeEach(async () => {
      await repo.createFinding({
        severity: "critical",
        tool: "wiz",
        asset: "asset-1",
        status: "open",
        title: "Finding 1",
        detectedAt: new Date().toISOString(),
      });
      await repo.createFinding({
        severity: "high",
        tool: "wiz",
        asset: "asset-2",
        status: "open",
        title: "Finding 2",
        detectedAt: new Date().toISOString(),
      });
      await repo.createFinding({
        severity: "critical",
        tool: "aws_inspector",
        asset: "asset-3",
        status: "resolved",
        title: "Finding 3",
        detectedAt: new Date().toISOString(),
      });
    });

    it("should return correct open count", async () => {
      const summary = await repo.getSecuritySummary();
      expect(summary.totalOpen).toBe(2);
    });

    it("should return correct severity breakdown", async () => {
      const summary = await repo.getSecuritySummary();
      expect(summary.bySeverity.critical).toBe(1);
      expect(summary.bySeverity.high).toBe(1);
      expect(summary.bySeverity.medium).toBe(0);
      expect(summary.bySeverity.low).toBe(0);
    });

    it("should return correct tool breakdown", async () => {
      const summary = await repo.getSecuritySummary();
      expect(summary.byTool.wiz).toBe(2);
      expect(summary.byTool.aws_inspector).toBe(0);
      expect(summary.byTool.artifactory_xray).toBe(0);
    });
  });
});
