import { describe, it, expect } from "vitest";
import { organizeEpics, calculateEpicProgress, calculateEpicRiskScore, sortEpics } from "../epic-utils";
import type { Event } from "@shared/schema";

describe("organizeEpics", () => {
  it("groups Jira events by epic", () => {
    const events: Event[] = [
      {
        id: "1",
        timestamp: new Date().toISOString(),
        source: "jira",
        type: "blocker",
        payload: {
          fields: {
            epic: "EPIC-1",
            issuetype: { name: "Story" },
            status: { name: "In Progress" },
          },
        },
        severity: "high",
        message: "Story 1",
        resolved: false,
        contextType: "general",
        serviceTags: [],
      },
      {
        id: "2",
        timestamp: new Date().toISOString(),
        source: "jira",
        type: "blocker",
        payload: {
          fields: {
            epic: "EPIC-1",
            issuetype: { name: "Story" },
            status: { name: "Done" },
          },
        },
        severity: "high",
        message: "Story 2",
        resolved: false,
        contextType: "general",
        serviceTags: [],
      },
      {
        id: "3",
        timestamp: new Date().toISOString(),
        source: "jira",
        type: "blocker",
        payload: {
          fields: {
            epic: "EPIC-2",
            issuetype: { name: "Story" },
            status: { name: "To Do" },
          },
        },
        severity: "high",
        message: "Story 3",
        resolved: false,
        contextType: "general",
        serviceTags: [],
      },
    ];

    const result = organizeEpics(events);
    expect(result).toHaveLength(2);
    expect(result[0].epicKey).toBe("EPIC-1");
    expect(result[0].tickets).toHaveLength(2);
    expect(result[1].epicKey).toBe("EPIC-2");
    expect(result[1].tickets).toHaveLength(1);
  });

  it("handles events without epic (groups as 'No Epic')", () => {
    const events: Event[] = [
      {
        id: "1",
        timestamp: new Date().toISOString(),
        source: "jira",
        type: "blocker",
        payload: {
          fields: {
            issuetype: { name: "Story" },
            status: { name: "In Progress" },
          },
        },
        severity: "high",
        message: "Story 1",
        resolved: false,
        contextType: "general",
        serviceTags: [],
      },
    ];

    const result = organizeEpics(events);
    expect(result).toHaveLength(1);
    expect(result[0].epicKey).toBe("No Epic");
    expect(result[0].tickets).toHaveLength(1);
  });
});

describe("calculateEpicProgress", () => {
  it("calculates 0% when no tickets are done", () => {
    const tickets: Event[] = [
      {
        id: "1",
        timestamp: new Date().toISOString(),
        source: "jira",
        type: "blocker",
        payload: {
          fields: {
            status: { name: "In Progress" },
          },
        },
        severity: "high",
        message: "Story 1",
        resolved: false,
        contextType: "general",
        serviceTags: [],
      },
    ];
    expect(calculateEpicProgress(tickets)).toBe(0);
  });

  it("calculates 100% when all tickets are done", () => {
    const tickets: Event[] = [
      {
        id: "1",
        timestamp: new Date().toISOString(),
        source: "jira",
        type: "blocker",
        payload: {
          fields: {
            status: { name: "Done" },
          },
        },
        severity: "high",
        message: "Story 1",
        resolved: false,
        contextType: "general",
        serviceTags: [],
      },
    ];
    expect(calculateEpicProgress(tickets)).toBe(100);
  });

  it("calculates 50% when half the tickets are done", () => {
    const tickets: Event[] = [
      {
        id: "1",
        timestamp: new Date().toISOString(),
        source: "jira",
        type: "blocker",
        payload: {
          fields: {
            status: { name: "Done" },
          },
        },
        severity: "high",
        message: "Story 1",
        resolved: false,
        contextType: "general",
        serviceTags: [],
      },
      {
        id: "2",
        timestamp: new Date().toISOString(),
        source: "jira",
        type: "blocker",
        payload: {
          fields: {
            status: { name: "In Progress" },
          },
        },
        severity: "high",
        message: "Story 2",
        resolved: false,
        contextType: "general",
        serviceTags: [],
      },
    ];
    expect(calculateEpicProgress(tickets)).toBe(50);
  });
});

describe("calculateEpicRiskScore", () => {
  it("returns high risk for epics with many open blockers", () => {
    const tickets: Event[] = [
      {
        id: "1",
        timestamp: new Date().toISOString(),
        source: "jira",
        type: "blocker",
        payload: {
          fields: {
            status: { name: "In Progress" },
            priority: { name: "Critical" },
          },
        },
        severity: "critical",
        message: "Blocker 1",
        resolved: false,
        contextType: "general",
        serviceTags: [],
      },
      {
        id: "2",
        timestamp: new Date().toISOString(),
        source: "jira",
        type: "blocker",
        payload: {
          fields: {
            status: { name: "In Progress" },
            priority: { name: "High" },
          },
        },
        severity: "high",
        message: "Blocker 2",
        resolved: false,
        contextType: "general",
        serviceTags: [],
      },
    ];
    const riskScore = calculateEpicRiskScore(tickets, new Date());
    // 2 open blockers: 40 (open ratio) + 20 (blockers) + 20 (severity) = 80
    expect(riskScore).toBeGreaterThanOrEqual(50);
    expect(riskScore).toBeLessThanOrEqual(100);
  });

  it("returns low risk for epics with mostly done tickets", () => {
    const tickets: Event[] = [
      {
        id: "1",
        timestamp: new Date().toISOString(),
        source: "jira",
        type: "blocker",
        payload: {
          fields: {
            status: { name: "Done" },
          },
        },
        severity: "low",
        message: "Done ticket",
        resolved: true,
        contextType: "general",
        serviceTags: [],
      },
    ];
    const riskScore = calculateEpicRiskScore(tickets, new Date());
    expect(riskScore).toBeLessThan(30);
  });
});

describe("sortEpics", () => {
  it("sorts by risk score first (highest first)", () => {
    const epics = [
      {
        epicKey: "EPIC-1",
        epicName: "Epic 1",
        tickets: [],
        releaseDate: new Date("2024-01-15"),
        progress: 50,
        riskScore: 80,
      },
      {
        epicKey: "EPIC-2",
        epicName: "Epic 2",
        tickets: [],
        releaseDate: new Date("2024-01-10"),
        progress: 30,
        riskScore: 90,
      },
    ];
    const sorted = sortEpics(epics);
    expect(sorted[0].epicKey).toBe("EPIC-2"); // Higher risk first
    expect(sorted[1].epicKey).toBe("EPIC-1");
  });

  it("sorts by release date when risk scores are equal", () => {
    const epics = [
      {
        epicKey: "EPIC-1",
        epicName: "Epic 1",
        tickets: [],
        releaseDate: new Date("2024-01-15"),
        progress: 50,
        riskScore: 80,
      },
      {
        epicKey: "EPIC-2",
        epicName: "Epic 2",
        tickets: [],
        releaseDate: new Date("2024-01-10"),
        progress: 30,
        riskScore: 80,
      },
    ];
    const sorted = sortEpics(epics);
    expect(sorted[0].epicKey).toBe("EPIC-2"); // Earlier date first
    expect(sorted[1].epicKey).toBe("EPIC-1");
  });
});
