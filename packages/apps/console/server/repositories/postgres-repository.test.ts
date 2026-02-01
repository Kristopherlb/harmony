import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { DbFixture } from "../test/db-fixture";
import type {
  IActivityRepository,
  ICommentRepository,
  IServiceCatalogRepository,
} from "../storage";
import type {
  Event,
  InsertEvent,
  Comment,
  InsertComment,
  Service,
  InsertService,
  Team,
  InsertTeam,
  EventSource,
  EventType,
  Severity,
  ServiceType,
  ServiceHealth,
  ServiceTier,
} from "@shared/schema";
import { randomUUID } from "crypto";

// This test file will fail until PostgresRepository is implemented
// It defines the contract that PostgresRepository must satisfy

/**
 * Contract tests for PostgresRepository.
 * These tests are skipped if DATABASE_URL is not set (integration tests require database).
 */
const shouldSkip = !process.env.DATABASE_URL;
describe.skipIf(shouldSkip)("PostgresRepository - Contract Tests", () => {
  let fixture: DbFixture;
  let repository: IActivityRepository & ICommentRepository & IServiceCatalogRepository;

  beforeAll(async () => {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("DATABASE_URL must be set for Postgres repository tests");
    }
    fixture = new DbFixture(databaseUrl);
  });

  afterAll(async () => {
    await fixture.close();
  });

  beforeEach(async () => {
    // Create repository instance - it will use getDb() which connects to the test database
    const { PostgresRepository } = await import("./postgres-repository");
    repository = new PostgresRepository();
    
    // Clean up any existing data before each test
    await fixture.truncateTables();
  });

  describe("IActivityRepository - Events", () => {
    it("should create an event and return it with generated id", async () => {
      const insertEvent: InsertEvent = {
        timestamp: new Date().toISOString(),
        source: "slack",
        type: "log",
        severity: "low",
        message: "Test event",
        payload: { test: true },
        resolved: false,
        contextType: "general",
        serviceTags: ["api"],
      };

      const event = await repository.createEvent(insertEvent);

      expect(event.id).toBeDefined();
      expect(event.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      expect(event.message).toBe(insertEvent.message);
      expect(event.source).toBe(insertEvent.source);
      expect(event.type).toBe(insertEvent.type);
    });

    it("should get events with pagination", async () => {
      // Create multiple events
      const events: Event[] = [];
      for (let i = 0; i < 25; i++) {
        const insertEvent: InsertEvent = {
          timestamp: new Date(Date.now() - i * 60000).toISOString(),
          source: "slack",
          type: "log",
          severity: "low",
          message: `Event ${i}`,
          payload: {},
          resolved: false,
          contextType: "general",
          serviceTags: [],
        };
        const event = await repository.createEvent(insertEvent);
        events.push(event);
      }

      const { events: page1, total } = await repository.getEvents({ page: 1, pageSize: 10 });

      expect(total).toBe(25);
      expect(page1).toHaveLength(10);
      expect(page1[0].timestamp).toBeGreaterThan(page1[9].timestamp); // Sorted desc
    });

    it("should get event by id", async () => {
      const insertEvent: InsertEvent = {
        timestamp: new Date().toISOString(),
        source: "gitlab",
        type: "release",
        severity: "medium",
        message: "Test release",
        payload: {},
        resolved: false,
        contextType: "general",
        serviceTags: [],
      };

      const created = await repository.createEvent(insertEvent);
      const found = await repository.getEventById(created.id);

      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
      expect(found?.message).toBe("Test release");
    });

    it("should return undefined for non-existent event id", async () => {
      const found = await repository.getEventById(randomUUID());
      expect(found).toBeUndefined();
    });

    it("should get events by source", async () => {
      await repository.createEvent({
        timestamp: new Date().toISOString(),
        source: "slack",
        type: "log",
        severity: "low",
        message: "Slack event",
        payload: {},
        resolved: false,
        contextType: "general",
        serviceTags: [],
      });

      await repository.createEvent({
        timestamp: new Date().toISOString(),
        source: "jira",
        type: "blocker",
        severity: "high",
        message: "Jira event",
        payload: {},
        resolved: false,
        contextType: "general",
        serviceTags: [],
      });

      const slackEvents = await repository.getEventsBySource("slack");
      expect(slackEvents.every((e) => e.source === "slack")).toBe(true);
    });

    it("should get events by user", async () => {
      const userId = "user-123";
      await repository.createEvent({
        timestamp: new Date().toISOString(),
        source: "slack",
        type: "log",
        severity: "low",
        message: "User event",
        payload: {},
        userId,
        username: "testuser",
        resolved: false,
        contextType: "general",
        serviceTags: [],
      });

      const userEvents = await repository.getEventsByUser(userId);
      expect(userEvents.every((e) => e.userId === userId)).toBe(true);
    });

    it("should update an event", async () => {
      const created = await repository.createEvent({
        timestamp: new Date().toISOString(),
        source: "slack",
        type: "blocker",
        severity: "high",
        message: "Original message",
        payload: {},
        resolved: false,
        contextType: "general",
        serviceTags: [],
      });

      const updated = await repository.updateEvent(created.id, {
        severity: "critical",
        message: "Updated message",
      });

      expect(updated?.severity).toBe("critical");
      expect(updated?.message).toBe("Updated message");
    });

    it("should resolve a blocker event", async () => {
      const blocker = await repository.createEvent({
        timestamp: new Date().toISOString(),
        source: "jira",
        type: "blocker",
        severity: "high",
        message: "Blocking issue",
        payload: {},
        resolved: false,
        contextType: "general",
        serviceTags: [],
      });

      const resolved = await repository.resolveBlocker(blocker.id);

      expect(resolved?.resolved).toBe(true);
      expect(resolved?.resolvedAt).toBeDefined();
    });

    it("should return undefined when resolving non-blocker event", async () => {
      const logEvent = await repository.createEvent({
        timestamp: new Date().toISOString(),
        source: "slack",
        type: "log",
        severity: "low",
        message: "Not a blocker",
        payload: {},
        resolved: false,
        contextType: "general",
        serviceTags: [],
      });

      const result = await repository.resolveBlocker(logEvent.id);
      expect(result).toBeUndefined();
    });

    it("should get user stats", async () => {
      const userId = "user-stats-test";
      const username = "testuser";

      // Create various events for this user
      await repository.createEvent({
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        source: "slack",
        type: "log",
        severity: "low",
        message: "Old log",
        payload: {},
        userId,
        username,
        resolved: false,
        contextType: "general",
        serviceTags: [],
      });

      await repository.createEvent({
        timestamp: new Date().toISOString(),
        source: "slack",
        type: "log",
        severity: "low",
        message: "Recent log",
        payload: {},
        userId,
        username,
        resolved: false,
        contextType: "general",
        serviceTags: [],
      });

      await repository.createEvent({
        timestamp: new Date().toISOString(),
        source: "jira",
        type: "blocker",
        severity: "high",
        message: "Blocking issue",
        payload: {},
        userId,
        username,
        resolved: true,
        resolvedAt: new Date().toISOString(),
        contextType: "general",
        serviceTags: [],
      });

      const stats = await repository.getUserStats(userId);

      expect(stats.userId).toBe(userId);
      expect(stats.username).toBe(username);
      expect(stats.totalEvents).toBeGreaterThan(0);
      expect(stats.logsThisWeek).toBeGreaterThanOrEqual(1);
    });

    it("should get DORA metrics", async () => {
      // Create release events
      await repository.createEvent({
        timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        source: "circleci",
        type: "release",
        severity: "low",
        message: "Release v1.0.0",
        payload: { failed: false },
        resolved: false,
        contextType: "general",
        serviceTags: [],
      });

      const metrics = await repository.getDORAMetrics();

      expect(metrics).toHaveProperty("deploymentFrequency");
      expect(metrics).toHaveProperty("leadTime");
      expect(metrics).toHaveProperty("meanTimeToRecovery");
      expect(metrics).toHaveProperty("changeFailureRate");
      expect(typeof metrics.deploymentFrequency).toBe("number");
    });
  });

  describe("ICommentRepository - Comments", () => {
    let testEvent: Event;

    beforeEach(async () => {
      testEvent = await repository.createEvent({
        timestamp: new Date().toISOString(),
        source: "slack",
        type: "log",
        severity: "low",
        message: "Test event for comments",
        payload: {},
        resolved: false,
        contextType: "general",
        serviceTags: [],
      });
    });

    it("should create a comment", async () => {
      const insertComment: InsertComment = {
        eventId: testEvent.id,
        userId: "user-123",
        username: "testuser",
        content: "This is a test comment",
      };

      const comment = await repository.createComment(insertComment);

      expect(comment.id).toBeDefined();
      expect(comment.eventId).toBe(testEvent.id);
      expect(comment.content).toBe("This is a test comment");
      expect(comment.createdAt).toBeDefined();
    });

    it("should get comments by event id", async () => {
      await repository.createComment({
        eventId: testEvent.id,
        userId: "user-1",
        username: "user1",
        content: "First comment",
      });

      await repository.createComment({
        eventId: testEvent.id,
        userId: "user-2",
        username: "user2",
        content: "Second comment",
      });

      const comments = await repository.getCommentsByEvent(testEvent.id);

      expect(comments).toHaveLength(2);
      expect(comments[0].eventId).toBe(testEvent.id);
      // Should be sorted by createdAt ascending
      expect(new Date(comments[0].createdAt).getTime()).toBeLessThanOrEqual(
        new Date(comments[1].createdAt).getTime()
      );
    });

    it("should delete a comment", async () => {
      const comment = await repository.createComment({
        eventId: testEvent.id,
        userId: "user-123",
        username: "testuser",
        content: "Comment to delete",
      });

      const deleted = await repository.deleteComment(comment.id);
      expect(deleted).toBe(true);

      const comments = await repository.getCommentsByEvent(testEvent.id);
      expect(comments.find((c) => c.id === comment.id)).toBeUndefined();
    });

    it("should return false when deleting non-existent comment", async () => {
      const deleted = await repository.deleteComment(randomUUID());
      expect(deleted).toBe(false);
    });
  });

  describe("IServiceCatalogRepository - Services and Teams", () => {
    let testTeam: Team;

    beforeEach(async () => {
      // Create a test team first (services depend on teams)
      const insertTeam: InsertTeam = {
        name: "Test Team",
        slug: "test-team",
        lead: "team-lead",
        slackChannel: "#test-team",
      };

      // TODO: Once PostgresRepository implements getTeams/createTeam
      // testTeam = await repository.createTeam(insertTeam);
      // For now, we'll need to create teams via direct DB access in fixture
      throw new Error("Team creation not yet implemented in PostgresRepository");
    });

    it("should create a service", async () => {
      const insertService: InsertService = {
        name: "Test Service",
        description: "A test service",
        type: "api",
        tier: "tier1",
        health: "healthy",
        teamId: testTeam.id,
        tags: ["test", "api"],
        dependencies: [],
      };

      // TODO: Once implemented
      // const service = await repository.createService(insertService);
      // expect(service.id).toBeDefined();
      // expect(service.name).toBe("Test Service");
    });

    it("should get all services", async () => {
      // TODO: Once implemented
      // const services = await repository.getServices();
      // expect(Array.isArray(services)).toBe(true);
    });

    it("should get services filtered by team", async () => {
      // TODO: Once implemented
      // const services = await repository.getServices({ teamId: testTeam.id });
      // expect(services.every((s) => s.teamId === testTeam.id)).toBe(true);
    });

    it("should get service by id", async () => {
      // TODO: Once implemented
      // const service = await repository.getServiceById(serviceId);
      // expect(service).toBeDefined();
    });

    it("should get all teams", async () => {
      // TODO: Once implemented
      // const teams = await repository.getTeams();
      // expect(Array.isArray(teams)).toBe(true);
    });

    it("should get team by id", async () => {
      // TODO: Once implemented
      // const team = await repository.getTeamById(testTeam.id);
      // expect(team?.id).toBe(testTeam.id);
    });
  });
});

