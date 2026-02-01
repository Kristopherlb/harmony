import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  MockAgentService,
  OpenAIAgentService,
  ExecutiveReportStrategy,
  StandupReportStrategy,
  StakeholderReportStrategy,
  reportStrategies,
  createAgentService,
} from "./agent-service";
import type { Event } from "@shared/schema";

const mockFetch = vi.fn();

function createMockEvents(): Event[] {
  const now = new Date();
  return [
    {
      id: "evt-1",
      timestamp: now.toISOString(),
      source: "gitlab",
      type: "release",
      severity: "low",
      message: "v2.4.0 deployed to production",
      payload: { leadTimeHours: 24 },
      resolved: false,
    },
    {
      id: "evt-2",
      timestamp: now.toISOString(),
      source: "slack",
      type: "blocker",
      severity: "high",
      message: "Database connection pool exhausted",
      payload: {},
      resolved: false,
    },
    {
      id: "evt-3",
      timestamp: now.toISOString(),
      source: "jira",
      type: "decision",
      severity: "medium",
      message: "ADR-042: Adopt GraphQL for mobile API",
      payload: {},
      resolved: true,
    },
    {
      id: "evt-4",
      timestamp: now.toISOString(),
      source: "pagerduty",
      type: "alert",
      severity: "critical",
      message: "High CPU usage on api-server-03",
      payload: {},
      resolved: false,
    },
  ];
}

describe("Report Strategies", () => {
  const events = createMockEvents();

  describe("ExecutiveReportStrategy", () => {
    const strategy = new ExecutiveReportStrategy();

    it("should return correct system prompt", () => {
      const prompt = strategy.getSystemPrompt();
      expect(prompt).toContain("executive");
      expect(prompt).toContain("SHIPPED");
      expect(prompt).toContain("BLOCKED");
    });

    it("should format context with shipped and blocked items", () => {
      const context = strategy.formatContext(events);
      expect(context).toContain("SHIPPED ITEMS");
      expect(context).toContain("BLOCKED ITEMS");
      expect(context).toContain("ACTIVE ALERTS");
    });

    it("should return correct style description", () => {
      expect(strategy.getStyleDescription()).toBe("Executive Summary");
    });
  });

  describe("StandupReportStrategy", () => {
    const strategy = new StandupReportStrategy();

    it("should return correct system prompt", () => {
      const prompt = strategy.getSystemPrompt();
      expect(prompt).toContain("standup");
      expect(prompt).toContain("accomplished yesterday");
      expect(prompt).toContain("blockers");
    });

    it("should format context with yesterday's activity and blockers", () => {
      const context = strategy.formatContext(events);
      expect(context).toContain("YESTERDAY'S ACTIVITY");
      expect(context).toContain("CURRENT BLOCKERS");
    });

    it("should return correct style description", () => {
      expect(strategy.getStyleDescription()).toBe("Standup Report");
    });
  });

  describe("StakeholderReportStrategy", () => {
    const strategy = new StakeholderReportStrategy();

    it("should return correct system prompt", () => {
      const prompt = strategy.getSystemPrompt();
      expect(prompt).toContain("stakeholder");
      expect(prompt).toContain("Value delivered");
      expect(prompt).toContain("Timeline risks");
    });

    it("should format context with value and risk sections", () => {
      const context = strategy.formatContext(events);
      expect(context).toContain("VALUE DELIVERED");
      expect(context).toContain("KEY DECISIONS");
      expect(context).toContain("TIMELINE RISKS");
      expect(context).toContain("CRITICAL ALERTS");
    });

    it("should return correct style description", () => {
      expect(strategy.getStyleDescription()).toBe("Stakeholder Report");
    });
  });

  describe("reportStrategies map", () => {
    it("should have all three strategies", () => {
      expect(reportStrategies.executive).toBeInstanceOf(ExecutiveReportStrategy);
      expect(reportStrategies.standup).toBeInstanceOf(StandupReportStrategy);
      expect(reportStrategies.stakeholder).toBeInstanceOf(StakeholderReportStrategy);
    });
  });
});

describe("MockAgentService", () => {
  const service = new MockAgentService();
  const events = createMockEvents();

  it("should generate executive report with correct structure", async () => {
    const report = await service.generateReport(events, "executive");

    expect(report.id).toBeDefined();
    expect(report.style).toBe("executive");
    expect(report.content).toContain("Executive Summary");
    expect(report.content).toContain("Shipped");
    expect(report.content).toContain("Blocked");
    expect(report.eventCount).toBe(events.length);
    expect(report.generatedAt).toBeDefined();
  });

  it("should generate standup report with correct structure", async () => {
    const report = await service.generateReport(events, "standup");

    expect(report.style).toBe("standup");
    expect(report.content).toContain("Standup Report");
    expect(report.content).toContain("Yesterday");
    expect(report.content).toContain("Blockers");
  });

  it("should generate stakeholder report with correct structure", async () => {
    const report = await service.generateReport(events, "stakeholder");

    expect(report.style).toBe("stakeholder");
    expect(report.content).toContain("Stakeholder Report");
    expect(report.content).toContain("Executive Summary");
    expect(report.content).toContain("Value Delivered");
  });

  it("should include event count in report", async () => {
    const report = await service.generateReport(events, "executive");
    expect(report.eventCount).toBe(4);
  });

  it("should handle empty events array", async () => {
    const report = await service.generateReport([], "standup");
    expect(report.eventCount).toBe(0);
    expect(report.content).toBeDefined();
  });
});

describe("OpenAIAgentService", () => {
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

  it("should report not configured when no API key", () => {
    delete process.env.OPENAI_API_KEY;
    const service = new OpenAIAgentService();
    expect(service.isConfigured()).toBe(false);
  });

  it("should report configured when API key is set", () => {
    process.env.OPENAI_API_KEY = "sk-test-key";
    const service = new OpenAIAgentService();
    expect(service.isConfigured()).toBe(true);
  });

  it("should fall back to mock service when not configured", async () => {
    delete process.env.OPENAI_API_KEY;
    const service = new OpenAIAgentService();
    const events = createMockEvents();
    
    const report = await service.generateReport(events, "executive");
    
    expect(report.style).toBe("executive");
    expect(report.content).toContain("Executive Summary");
  });

  it("should call OpenAI API when configured", async () => {
    process.env.OPENAI_API_KEY = "sk-test-key";
    
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({
        choices: [
          {
            message: {
              content: "# AI Generated Report\n\nThis is the generated content.",
            },
          },
        ],
      }),
    });

    const service = new OpenAIAgentService("sk-test-key");
    const events = createMockEvents();
    const report = await service.generateReport(events, "executive");

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(report.content).toContain("AI Generated Report");
  });

  it("should fall back to mock on API error", async () => {
    process.env.OPENAI_API_KEY = "sk-test-key";
    
    mockFetch.mockRejectedValueOnce(new Error("API Error"));

    const service = new OpenAIAgentService("sk-test-key");
    const events = createMockEvents();
    const report = await service.generateReport(events, "standup");

    expect(report.style).toBe("standup");
    expect(report.content).toBeDefined();
  });
});

describe("createAgentService", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should return MockAgentService when no API key", () => {
    delete process.env.OPENAI_API_KEY;
    const service = createAgentService();
    expect(service).toBeInstanceOf(MockAgentService);
  });

  it("should return OpenAIAgentService when API key is set", () => {
    process.env.OPENAI_API_KEY = "sk-test-key";
    const service = createAgentService();
    expect(service).toBeInstanceOf(OpenAIAgentService);
  });
});
