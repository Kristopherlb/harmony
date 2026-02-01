import { describe, it, expect } from "vitest";
import { SeedableMemoryRepository } from "./storage";
import type { Event } from "@shared/schema";
import { GetDORAMetrics } from "./metrics/application/get-dora-metrics";
import { EventRepositoryAdapter } from "./events/adapters/event-repository-adapter";

describe("DORA Metrics Calculations", () => {
  describe("deploymentFrequency", () => {
    it("should calculate deployment frequency as CircleCI releases per day over 30 days", async () => {
      const now = new Date();
      const events: Event[] = [];
      
      for (let i = 0; i < 15; i++) {
        const date = new Date(now);
        date.setDate(date.getDate() - i * 2);
        events.push({
          id: `release-${i}`,
          timestamp: date.toISOString(),
          source: "circleci",
          type: "release",
          severity: "low",
          message: `v1.${i}.0 deployed`,
          payload: { 
            leadTimeHours: 24,
            releaseKey: `1.${i}.0`,
            revision: `abc${i}`,
            branch: `release/v1.${i}.0`,
            repoKey: "org/repo",
            workflowName: "deploy-prod",
          },
          resolved: false,
        });
      }

      const repo = new SeedableMemoryRepository({ events });
      const eventRepository = new EventRepositoryAdapter(repo);
      const getDORAMetrics = new GetDORAMetrics(eventRepository);
      const metrics = await getDORAMetrics.execute();

      expect(metrics.deploymentFrequency).toBe(15 / 30);
    });

    it("should return 0 when no releases exist", async () => {
      const repo = new SeedableMemoryRepository({ events: [] });
      const eventRepository = new EventRepositoryAdapter(repo);
      const getDORAMetrics = new GetDORAMetrics(eventRepository);
      const metrics = await getDORAMetrics.execute();

      expect(metrics.deploymentFrequency).toBe(0);
    });

    it("should only count CircleCI releases from the last 30 days", async () => {
      const now = new Date();
      const recentDate = new Date(now);
      recentDate.setDate(recentDate.getDate() - 10);
      const oldDate = new Date(now);
      oldDate.setDate(oldDate.getDate() - 45);

      const events: Event[] = [
        {
          id: "recent-release",
          timestamp: recentDate.toISOString(),
          source: "circleci",
          type: "release",
          severity: "low",
          message: "Recent release",
          payload: { 
            leadTimeHours: 12,
            releaseKey: "1.0.0",
            revision: "abc123",
            branch: "release/v1.0.0",
            repoKey: "org/repo",
            workflowName: "deploy-prod",
          },
          resolved: false,
        },
        {
          id: "old-release",
          timestamp: oldDate.toISOString(),
          source: "circleci",
          type: "release",
          severity: "low",
          message: "Old release",
          payload: { 
            leadTimeHours: 12,
            releaseKey: "0.9.0",
            revision: "def456",
            branch: "release/v0.9.0",
            repoKey: "org/repo",
            workflowName: "deploy-prod",
          },
          resolved: false,
        },
        {
          id: "gitlab-release",
          timestamp: recentDate.toISOString(),
          source: "gitlab",
          type: "release",
          severity: "low",
          message: "GitLab release (should not count)",
          payload: { leadTimeHours: 12 },
          resolved: false,
        },
      ];

      const repo = new SeedableMemoryRepository({ events });
      const eventRepository = new EventRepositoryAdapter(repo);
      const getDORAMetrics = new GetDORAMetrics(eventRepository);
      const metrics = await getDORAMetrics.execute();

      // Should only count the recent CircleCI release, not GitLab or old releases
      expect(metrics.deploymentFrequency).toBe(1 / 30);
    });
  });

  describe("leadTime", () => {
    it("should calculate average lead time from release payloads", async () => {
      const now = new Date();
      const events: Event[] = [
        {
          id: "release-1",
          timestamp: now.toISOString(),
          source: "gitlab",
          type: "release",
          severity: "low",
          message: "Release 1",
          payload: { leadTimeHours: 10 },
          resolved: false,
        },
        {
          id: "release-2",
          timestamp: now.toISOString(),
          source: "gitlab",
          type: "release",
          severity: "low",
          message: "Release 2",
          payload: { leadTimeHours: 20 },
          resolved: false,
        },
        {
          id: "release-3",
          timestamp: now.toISOString(),
          source: "gitlab",
          type: "release",
          severity: "low",
          message: "Release 3",
          payload: { leadTimeHours: 30 },
          resolved: false,
        },
      ];

      const repo = new SeedableMemoryRepository({ events });
      const eventRepository = new EventRepositoryAdapter(repo);
      const getDORAMetrics = new GetDORAMetrics(eventRepository);
      const metrics = await getDORAMetrics.execute();

      expect(metrics.leadTime).toBe(20);
    });

    it("should default to 24 hours when leadTimeHours not in payload", async () => {
      const now = new Date();
      const events: Event[] = [
        {
          id: "release-1",
          timestamp: now.toISOString(),
          source: "gitlab",
          type: "release",
          severity: "low",
          message: "Release without lead time",
          payload: {},
          resolved: false,
        },
      ];

      const repo = new SeedableMemoryRepository({ events });
      const eventRepository = new EventRepositoryAdapter(repo);
      const getDORAMetrics = new GetDORAMetrics(eventRepository);
      const metrics = await getDORAMetrics.execute();

      expect(metrics.leadTime).toBe(24);
    });

    it("should return 0 when no releases exist", async () => {
      const repo = new SeedableMemoryRepository({ events: [] });
      const eventRepository = new EventRepositoryAdapter(repo);
      const getDORAMetrics = new GetDORAMetrics(eventRepository);
      const metrics = await getDORAMetrics.execute();

      expect(metrics.leadTime).toBe(0);
    });
  });

  describe("meanTimeToRecovery", () => {
    it("should calculate MTTR from resolved blockers", async () => {
      const createdTime = new Date("2026-01-10T10:00:00.000Z");
      const resolvedTime = new Date("2026-01-10T14:00:00.000Z");

      const events: Event[] = [
        {
          id: "blocker-1",
          timestamp: createdTime.toISOString(),
          source: "pagerduty",
          type: "blocker",
          severity: "critical",
          message: "Outage",
          payload: {},
          resolved: true,
          resolvedAt: resolvedTime.toISOString(),
        },
      ];

      const repo = new SeedableMemoryRepository({ events });
      const eventRepository = new EventRepositoryAdapter(repo);
      const getDORAMetrics = new GetDORAMetrics(eventRepository);
      const metrics = await getDORAMetrics.execute();

      expect(metrics.meanTimeToRecovery).toBe(4);
    });

    it("should calculate average MTTR across multiple blockers", async () => {
      const events: Event[] = [
        {
          id: "blocker-1",
          timestamp: "2026-01-10T10:00:00.000Z",
          source: "pagerduty",
          type: "blocker",
          severity: "critical",
          message: "Outage 1",
          payload: {},
          resolved: true,
          resolvedAt: "2026-01-10T12:00:00.000Z",
        },
        {
          id: "blocker-2",
          timestamp: "2026-01-11T10:00:00.000Z",
          source: "pagerduty",
          type: "blocker",
          severity: "critical",
          message: "Outage 2",
          payload: {},
          resolved: true,
          resolvedAt: "2026-01-11T16:00:00.000Z",
        },
      ];

      const repo = new SeedableMemoryRepository({ events });
      const eventRepository = new EventRepositoryAdapter(repo);
      const getDORAMetrics = new GetDORAMetrics(eventRepository);
      const metrics = await getDORAMetrics.execute();

      expect(metrics.meanTimeToRecovery).toBe(4);
    });

    it("should ignore unresolved blockers", async () => {
      const events: Event[] = [
        {
          id: "blocker-resolved",
          timestamp: "2026-01-10T10:00:00.000Z",
          source: "pagerduty",
          type: "blocker",
          severity: "critical",
          message: "Resolved",
          payload: {},
          resolved: true,
          resolvedAt: "2026-01-10T14:00:00.000Z",
        },
        {
          id: "blocker-unresolved",
          timestamp: "2026-01-11T10:00:00.000Z",
          source: "pagerduty",
          type: "blocker",
          severity: "critical",
          message: "Still open",
          payload: {},
          resolved: false,
        },
      ];

      const repo = new SeedableMemoryRepository({ events });
      const eventRepository = new EventRepositoryAdapter(repo);
      const getDORAMetrics = new GetDORAMetrics(eventRepository);
      const metrics = await getDORAMetrics.execute();

      expect(metrics.meanTimeToRecovery).toBe(4);
    });

    it("should return 0 when no resolved blockers exist", async () => {
      const repo = new SeedableMemoryRepository({ events: [] });
      const eventRepository = new EventRepositoryAdapter(repo);
      const getDORAMetrics = new GetDORAMetrics(eventRepository);
      const metrics = await getDORAMetrics.execute();

      expect(metrics.meanTimeToRecovery).toBe(0);
    });
  });

  describe("changeFailureRate", () => {
    it("should calculate change failure rate from failed releases", async () => {
      const now = new Date();
      const events: Event[] = [
        {
          id: "release-1",
          timestamp: now.toISOString(),
          source: "circleci",
          type: "release",
          severity: "low",
          message: "Success 1",
          payload: { 
            failed: false,
            releaseKey: "1.0.0",
            revision: "abc123",
            branch: "release/v1.0.0",
            repoKey: "org/repo",
            workflowName: "deploy-prod",
          },
          resolved: false,
        },
        {
          id: "release-2",
          timestamp: now.toISOString(),
          source: "circleci",
          type: "release",
          severity: "low",
          message: "Failed",
          payload: { 
            failed: true,
            releaseKey: "1.0.1",
            revision: "def456",
            branch: "release/v1.0.1",
            repoKey: "org/repo",
            workflowName: "deploy-prod",
          },
          resolved: false,
        },
        {
          id: "release-3",
          timestamp: now.toISOString(),
          source: "circleci",
          type: "release",
          severity: "low",
          message: "Success 2",
          payload: { 
            failed: false,
            releaseKey: "1.0.2",
            revision: "ghi789",
            branch: "release/v1.0.2",
            repoKey: "org/repo",
            workflowName: "deploy-prod",
          },
          resolved: false,
        },
        {
          id: "release-4",
          timestamp: now.toISOString(),
          source: "circleci",
          type: "release",
          severity: "low",
          message: "Success 3",
          payload: { 
            failed: false,
            releaseKey: "1.0.3",
            revision: "jkl012",
            branch: "release/v1.0.3",
            repoKey: "org/repo",
            workflowName: "deploy-prod",
          },
          resolved: false,
        },
      ];

      const repo = new SeedableMemoryRepository({ events });
      const eventRepository = new EventRepositoryAdapter(repo);
      const getDORAMetrics = new GetDORAMetrics(eventRepository);
      const metrics = await getDORAMetrics.execute();

      expect(metrics.changeFailureRate).toBe(0.25);
    });

    it("should return 0 when no releases exist", async () => {
      const repo = new SeedableMemoryRepository({ events: [] });
      const eventRepository = new EventRepositoryAdapter(repo);
      const getDORAMetrics = new GetDORAMetrics(eventRepository);
      const metrics = await getDORAMetrics.execute();

      expect(metrics.changeFailureRate).toBe(0);
    });

    it("should return 0 when no releases have failed", async () => {
      const now = new Date();
      const events: Event[] = [
        {
          id: "release-1",
          timestamp: now.toISOString(),
          source: "circleci",
          type: "release",
          severity: "low",
          message: "Success",
          payload: { 
            failed: false,
            releaseKey: "1.0.0",
            revision: "abc123",
            branch: "release/v1.0.0",
            repoKey: "org/repo",
            workflowName: "deploy-prod",
          },
          resolved: false,
        },
      ];

      const repo = new SeedableMemoryRepository({ events });
      const eventRepository = new EventRepositoryAdapter(repo);
      const getDORAMetrics = new GetDORAMetrics(eventRepository);
      const metrics = await getDORAMetrics.execute();

      expect(metrics.changeFailureRate).toBe(0);
    });
  });
});
