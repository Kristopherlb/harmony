import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  calculateAtRisk,
  getReadinessColor,
  getReadinessLabel,
  calculateReadinessScore,
  calculateCombinedReadinessScore,
} from "../utils";
import type { PrepItem } from "../types";

describe("calculateAtRisk", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns false for completed items", () => {
    const item: Omit<PrepItem, "resolver"> = {
      id: "test",
      label: "Test",
      description: "Test item",
      completed: true,
      atRisk: false,
      manualAtRisk: false,
      resolverType: "manual",
    };
    expect(calculateAtRisk(item)).toBe(false);
  });

  it("returns true when manualAtRisk is set", () => {
    const item: Omit<PrepItem, "resolver"> = {
      id: "test",
      label: "Test",
      description: "Test item",
      completed: false,
      atRisk: false,
      manualAtRisk: true,
      resolverType: "manual",
    };
    expect(calculateAtRisk(item)).toBe(true);
  });

  it("returns true when deadline is less than 1 day away", () => {
    const now = new Date();
    vi.setSystemTime(now);
    
    // Set deadline to 12 hours from now (less than 1 day)
    const deadline = new Date(now.getTime() + 12 * 60 * 60 * 1000);

    const item: Omit<PrepItem, "resolver"> = {
      id: "test",
      label: "Test",
      description: "Test item",
      completed: false,
      atRisk: false,
      manualAtRisk: false,
      resolverType: "manual",
      deadline: deadline,
    };
    expect(calculateAtRisk(item)).toBe(true);
  });

  it("returns false when deadline is more than 1 day away", () => {
    const twoDaysFromNow = new Date();
    twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);

    vi.setSystemTime(new Date());

    const item: Omit<PrepItem, "resolver"> = {
      id: "test",
      label: "Test",
      description: "Test item",
      completed: false,
      atRisk: false,
      manualAtRisk: false,
      resolverType: "manual",
      deadline: twoDaysFromNow,
    };
    expect(calculateAtRisk(item)).toBe(false);
  });

  it("returns false when no deadline is set", () => {
    const item: Omit<PrepItem, "resolver"> = {
      id: "test",
      label: "Test",
      description: "Test item",
      completed: false,
      atRisk: false,
      manualAtRisk: false,
      resolverType: "manual",
    };
    expect(calculateAtRisk(item)).toBe(false);
  });
});

describe("getReadinessColor", () => {
  it("returns healthy color for score >= 90", () => {
    expect(getReadinessColor(90)).toBe("text-status-healthy");
    expect(getReadinessColor(100)).toBe("text-status-healthy");
  });

  it("returns primary color for score >= 75 and < 90", () => {
    expect(getReadinessColor(75)).toBe("text-primary");
    expect(getReadinessColor(89)).toBe("text-primary");
  });

  it("returns degraded color for score >= 60 and < 75", () => {
    expect(getReadinessColor(60)).toBe("text-status-degraded");
    expect(getReadinessColor(74)).toBe("text-status-degraded");
  });

  it("returns critical color for score < 60", () => {
    expect(getReadinessColor(59)).toBe("text-status-critical");
    expect(getReadinessColor(0)).toBe("text-status-critical");
  });
});

describe("getReadinessLabel", () => {
  it("returns 'Ready' for score >= 90", () => {
    expect(getReadinessLabel(90)).toBe("Ready");
    expect(getReadinessLabel(100)).toBe("Ready");
  });

  it("returns 'Almost Ready' for score >= 75 and < 90", () => {
    expect(getReadinessLabel(75)).toBe("Almost Ready");
    expect(getReadinessLabel(89)).toBe("Almost Ready");
  });

  it("returns 'Needs Work' for score >= 60 and < 75", () => {
    expect(getReadinessLabel(60)).toBe("Needs Work");
    expect(getReadinessLabel(74)).toBe("Needs Work");
  });

  it("returns 'Not Ready' for score < 60", () => {
    expect(getReadinessLabel(59)).toBe("Not Ready");
    expect(getReadinessLabel(0)).toBe("Not Ready");
  });
});

describe("calculateReadinessScore", () => {
  it("returns 100 when all items are completed", () => {
    const items: PrepItem[] = [
      {
        id: "1",
        label: "Item 1",
        description: "Test",
        completed: true,
        atRisk: false,
        manualAtRisk: false,
        resolverType: "manual",
        resolver: () => {},
      },
      {
        id: "2",
        label: "Item 2",
        description: "Test",
        completed: true,
        atRisk: false,
        manualAtRisk: false,
        resolverType: "manual",
        resolver: () => {},
      },
    ];
    expect(calculateReadinessScore(items)).toBe(100);
  });

  it("returns 0 when no items are completed", () => {
    const items: PrepItem[] = [
      {
        id: "1",
        label: "Item 1",
        description: "Test",
        completed: false,
        atRisk: false,
        manualAtRisk: false,
        resolverType: "manual",
        resolver: () => {},
      },
      {
        id: "2",
        label: "Item 2",
        description: "Test",
        completed: false,
        atRisk: false,
        manualAtRisk: false,
        resolverType: "manual",
        resolver: () => {},
      },
    ];
    expect(calculateReadinessScore(items)).toBe(0);
  });

  it("returns 50 when half the items are completed", () => {
    const items: PrepItem[] = [
      {
        id: "1",
        label: "Item 1",
        description: "Test",
        completed: true,
        atRisk: false,
        manualAtRisk: false,
        resolverType: "manual",
        resolver: () => {},
      },
      {
        id: "2",
        label: "Item 2",
        description: "Test",
        completed: false,
        atRisk: false,
        manualAtRisk: false,
        resolverType: "manual",
        resolver: () => {},
      },
    ];
    expect(calculateReadinessScore(items)).toBe(50);
  });

  it("returns 100 when items array is empty", () => {
    expect(calculateReadinessScore([])).toBe(100);
  });
});

describe("calculateCombinedReadinessScore", () => {
  it("calculates score with 60% prep and 40% jira weight", () => {
    // 100% prep, 100% jira (0 open items) = 100% combined
    expect(calculateCombinedReadinessScore(0, 10, 10)).toBe(100);
    
    // 50% prep, 100% jira (0 open items) = 70% combined (50 * 0.6 + 100 * 0.4)
    expect(calculateCombinedReadinessScore(0, 5, 10)).toBe(70);
    
    // 100% prep, 5 open jira items = 75% jira score (100 - (5/10)*50)
    // Combined: 100 * 0.6 + 75 * 0.4 = 60 + 30 = 90
    expect(calculateCombinedReadinessScore(5, 10, 10)).toBe(90);
  });

  it("handles edge cases", () => {
    // No prep items
    expect(calculateCombinedReadinessScore(0, 0, 0)).toBe(100);
    
    // Many jira items (should reduce score)
    expect(calculateCombinedReadinessScore(20, 10, 10)).toBeLessThan(100);
  });
});
