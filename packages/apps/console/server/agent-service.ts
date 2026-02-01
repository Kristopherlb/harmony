import { v4 as uuidv4 } from "uuid";
import type { Event, ReportStyle, AgentReport } from "@shared/schema";
import { mcpClient } from "./agent/adapters/mcp-adapter";

export interface BlueprintDraft {
  id: string;
  steps: {
    capabilityId: string;
    name: string;
    params: Record<string, unknown>;
  }[];
  explanation: string;
}

export interface IAgentService {
  generateReport(context: Event[], style: ReportStyle): Promise<AgentReport>;
  proposeBlueprint(intent: string): Promise<BlueprintDraft>;
}

export interface ReportStrategy {
  getSystemPrompt(): string;
  formatContext(events: Event[]): string;
  getStyleDescription(): string;
}

export class ExecutiveReportStrategy implements ReportStrategy {
  getSystemPrompt(): string {
    return `You are a senior engineering executive assistant. Generate a high-level executive summary focusing strictly on:
1. Items that were SHIPPED (releases, deployments, completed work)
2. Items that are BLOCKED (blockers, critical issues, at-risk items)

Keep the tone professional and concise. Use bullet points. Focus on business impact.`;
  }

  formatContext(events: Event[]): string {
    const shipped = events.filter(e => e.type === "release" || (e.type === "decision" && e.resolved));
    const blocked = events.filter(e => e.type === "blocker" && !e.resolved);
    const alerts = events.filter(e => e.type === "alert" && !e.resolved);

    return `SHIPPED ITEMS (${shipped.length}):
${shipped.map(e => `- [${e.source}] ${e.message}`).join("\n") || "None"}

BLOCKED ITEMS (${blocked.length}):
${blocked.map(e => `- [${e.source}] ${e.message} (Severity: ${e.severity})`).join("\n") || "None"}

ACTIVE ALERTS (${alerts.length}):
${alerts.map(e => `- [${e.source}] ${e.message} (Severity: ${e.severity})`).join("\n") || "None"}`;
  }

  getStyleDescription(): string {
    return "Executive Summary";
  }
}

export class StandupReportStrategy implements ReportStrategy {
  getSystemPrompt(): string {
    return `You are an engineering standup facilitator. Generate a standup-style report with:
1. What was accomplished yesterday
2. Current blockers and impediments
3. Key items in progress

Use bullet points. Be concise and actionable.`;
  }

  formatContext(events: Event[]): string {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStart = new Date(yesterday.setHours(0, 0, 0, 0));
    const yesterdayEnd = new Date(yesterday.setHours(23, 59, 59, 999));

    const yesterdayEvents = events.filter(e => {
      const eventDate = new Date(e.timestamp);
      return eventDate >= yesterdayStart && eventDate <= yesterdayEnd;
    });

    const blockers = events.filter(e => e.type === "blocker" && !e.resolved);

    return `YESTERDAY'S ACTIVITY (${yesterdayEvents.length} events):
${yesterdayEvents.map(e => `- [${e.source}/${e.type}] ${e.message}`).join("\n") || "No activity logged"}

CURRENT BLOCKERS (${blockers.length}):
${blockers.map(e => `- ${e.message} (${e.severity})`).join("\n") || "No blockers"}`;
  }

  getStyleDescription(): string {
    return "Standup Report";
  }
}

export class StakeholderReportStrategy implements ReportStrategy {
  getSystemPrompt(): string {
    return `You are a technical program manager communicating with stakeholders. Generate a narrative-style report focusing on:
1. Value delivered to the business
2. Timeline risks and mitigations
3. Key decisions made and their rationale
4. Upcoming milestones

Use a professional narrative tone. Focus on outcomes rather than technical details.`;
  }

  formatContext(events: Event[]): string {
    const releases = events.filter(e => e.type === "release");
    const decisions = events.filter(e => e.type === "decision");
    const blockers = events.filter(e => e.type === "blocker");
    const alerts = events.filter(e => e.type === "alert" && e.severity === "critical");

    return `VALUE DELIVERED - Releases (${releases.length}):
${releases.map(e => `- ${e.message}`).join("\n") || "No releases this period"}

KEY DECISIONS (${decisions.length}):
${decisions.map(e => `- ${e.message}`).join("\n") || "No decisions logged"}

TIMELINE RISKS - Blockers (${blockers.length}):
${blockers.map(e => `- ${e.message} [${e.resolved ? "RESOLVED" : "OPEN"}]`).join("\n") || "No blockers"}

CRITICAL ALERTS (${alerts.length}):
${alerts.map(e => `- ${e.message} from ${e.source}`).join("\n") || "No critical alerts"}`;
  }

  getStyleDescription(): string {
    return "Stakeholder Report";
  }
}

export const reportStrategies: Record<ReportStyle, ReportStrategy> = {
  executive: new ExecutiveReportStrategy(),
  standup: new StandupReportStrategy(),
  stakeholder: new StakeholderReportStrategy(),
};

export class MockAgentService implements IAgentService {
  async generateReport(context: Event[], style: ReportStyle): Promise<AgentReport> {
    const strategy = reportStrategies[style];
    const formattedContext = strategy.formatContext(context);

    const mockContent = this.generateMockContent(style, context, formattedContext);

    return {
      id: uuidv4(),
      style,
      content: mockContent,
      generatedAt: new Date().toISOString(),
      eventCount: context.length,
      timeRangeDays: 7,
    };
  }

  private generateMockContent(style: ReportStyle, events: Event[], formattedContext: string): string {
    const strategy = reportStrategies[style];
    const styleDesc = strategy.getStyleDescription();

    const shipped = events.filter(e => e.type === "release").length;
    const blocked = events.filter(e => e.type === "blocker" && !e.resolved).length;
    const decisions = events.filter(e => e.type === "decision").length;

    switch (style) {
      case "executive":
        return `# ${styleDesc}

## Summary
Analyzed ${events.length} events from engineering operations.

## Shipped
- ${shipped} releases completed this period

## Blocked
- ${blocked} active blockers requiring attention

## Recommendation
${blocked > 0 ? "Prioritize blocker resolution to maintain velocity." : "Team is operating smoothly with no critical blockers."}`;

      case "standup":
        return `# ${styleDesc}

## Yesterday
- Processed ${events.length} engineering events
- ${shipped} items shipped

## Blockers
${blocked > 0 ? `- ${blocked} blockers need attention` : "- No blockers"}

## Today's Focus
- Continue monitoring active alerts
- Address any emerging blockers`;

      case "stakeholder":
        return `# ${styleDesc}

## Executive Summary
This reporting period saw ${events.length} engineering activities across all integrated systems.

## Value Delivered
${shipped} releases were successfully deployed, demonstrating continued delivery capability.

## Key Decisions
${decisions} architectural or process decisions were documented for future reference.

## Risk Assessment
${blocked > 0
            ? `There are ${blocked} active blockers that may impact upcoming deliverables. The team is actively working on resolution.`
            : "No significant risks to timeline. All systems operating within normal parameters."}

## Outlook
The engineering team continues to maintain strong operational health with robust monitoring and rapid response capabilities.`;

      default:
        return `Report generated for ${events.length} events.`;
    }
  }

  async proposeBlueprint(intent: string): Promise<BlueprintDraft> {
    // Mock implementation returning a hardcoded draft
    return {
      id: uuidv4(),
      explanation: `I've designed a workflow to address your request: "${intent}". It involves pulling data from Jira, summarizing it with an Agent, and posting to Slack.`,
      steps: [
        {
          capabilityId: "jira-get-issues",
          name: "Jira: Get Blocked Issues",
          params: { jql: "status = Blocked AND project = PLAT" },
        },
        {
          capabilityId: "agent-summarize",
          name: "Agent: Summarize",
          params: { style: "executive" },
        },
        {
          capabilityId: "slack-send",
          name: "Slack: Notify Channel",
          params: { channel: "#engineering-alerts" },
        },
      ],
    };
  }
}

export class OpenAIAgentService implements IAgentService {
  private apiKey: string;
  private model: string;

  constructor(apiKey?: string, model: string = "gpt-4o") {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || "";
    this.model = model;
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async generateReport(context: Event[], style: ReportStyle): Promise<AgentReport> {
    if (!this.isConfigured()) {
      console.warn("OpenAI not configured, falling back to mock service");
      const mockService = new MockAgentService();
      return mockService.generateReport(context, style);
    }

    const strategy = reportStrategies[style];
    const systemPrompt = strategy.getSystemPrompt();
    const formattedContext = strategy.formatContext(context);

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Generate a report based on the following engineering activity:\n\n${formattedContext}` },
          ],
          temperature: 0.7,
          max_tokens: 1500,
        }),
      });

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "Failed to generate report.";

      return {
        id: uuidv4(),
        style,
        content,
        generatedAt: new Date().toISOString(),
        eventCount: context.length,
        timeRangeDays: 7,
      };
    } catch (error) {
      console.error("OpenAI API error:", error);
      const mockService = new MockAgentService();
      return mockService.generateReport(context, style);
    }
  }

  async proposeBlueprint(intent: string): Promise<BlueprintDraft> {
    if (!this.isConfigured()) {
      console.warn("OpenAI not configured, falling back to mock service");
      const mockService = new MockAgentService();
      return mockService.proposeBlueprint(intent);
    }

    try {
      // 1. Fetch available tools from MCP
      const tools = await mcpClient.getAvailableTools();

      // 2. Construct System Prompt
      const toolsContext = tools.map(t =>
        `- ${t.name}: ${t.description || "No description"} (Params: ${JSON.stringify(t.inputSchema)})`
      ).join("\n");

      const systemPrompt = `You are a Workflow Architect. Your goal is to design a linear workflow based on the user's request.

Available Capabilities (use only these):
${toolsContext}

Instructions:
- Return strictly valid JSON matching the BlueprintDraft schema.
- Map the user's intent to a sequence of capabilities.
- "capabilityId" must match one of the available tool names exactly.
- "params" must respect the inputSchema for that tool.
- "explanation" should briefly explain your design.

Output Schema:
{
  "id": "string (uuid)",
  "explanation": "string",
  "steps": [
    { "capabilityId": "string", "name": "string (human readable)", "params": { ... } }
  ]
}`;

      // 3. Call OpenAI with JSON mode
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: intent },
          ],
          response_format: { type: "json_object" },
          temperature: 0.1, // Low temperature for deterministic code generation
        }),
      });

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error("No content received from OpenAI");
      }

      console.log("OpenAI Blueprint Response:", content);

      // 4. Parse and Validate
      const draft = JSON.parse(content) as BlueprintDraft;

      // Ensure IDs are unique if LLM didn't provide one
      if (!draft.id) draft.id = uuidv4();

      return draft;

    } catch (error) {
      console.error("Error creating blueprint with OpenAI:", error);
      const mockService = new MockAgentService();
      return mockService.proposeBlueprint(intent);
    }
  }
}

export function createAgentService(): IAgentService {
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey) {
    return new OpenAIAgentService(apiKey);
  }
  return new MockAgentService();
}
