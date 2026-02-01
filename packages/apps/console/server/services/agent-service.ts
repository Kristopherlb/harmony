import { v4 as uuid } from "uuid";
import type { 
  ChatMessage, 
  ChatRequest, 
  ChatResponse, 
  AgentTool, 
  LLMProvider,
  Event,
  Service,
  DORAMetrics 
} from "@shared/schema";

export interface AgentContext {
  events: Event[];
  services: Service[];
  metrics: DORAMetrics | null;
}

export interface IAgentToolExecutor {
  name: string;
  description: string;
  category: "query" | "action" | "report";
  provider?: string;
  execute: (params: Record<string, unknown>, context: AgentContext) => Promise<{
    success: boolean;
    result: string;
    data?: unknown;
  }>;
}

export interface ILLMProvider {
  name: LLMProvider;
  chat: (messages: ChatMessage[], tools: AgentTool[]) => Promise<{
    content: string;
    toolCalls?: { tool: string; params: Record<string, unknown> }[];
  }>;
}

export class MockLLMProvider implements ILLMProvider {
  name: LLMProvider = "mock";

  async chat(messages: ChatMessage[], tools: AgentTool[]): Promise<{
    content: string;
    toolCalls?: { tool: string; params: Record<string, unknown> }[];
  }> {
    const lastMessage = messages[messages.length - 1];
    const userQuery = lastMessage?.content.toLowerCase() || "";

    if (userQuery.includes("standup") || userQuery.includes("report")) {
      return {
        content: "Here's your standup report for the last 24 hours:\n\n**Deployments:** 3 successful deployments to production\n**Incidents:** 1 minor incident (resolved in 15 min)\n**Blockers:** None active\n**Key Decisions:** Approved migration to new caching layer\n\nOverall team velocity is healthy with 95% deployment success rate.",
        toolCalls: [{ tool: "generate_report", params: { style: "standup", days: 1 } }],
      };
    }

    if (userQuery.includes("critical") || userQuery.includes("issues") || userQuery.includes("problems")) {
      return {
        content: "I found 2 services requiring attention:\n\n1. **payment-api** - Critical health, error rate at 2.3%\n2. **ml-inference** - Degraded health, high latency (P99: 1200ms)\n\nRecommended actions:\n- Check payment-api logs for recent errors\n- Scale ml-inference pods or investigate memory pressure",
      };
    }

    if (userQuery.includes("jira") || userQuery.includes("ticket")) {
      return {
        content: "I'll create a Jira ticket for you. Please provide:\n- **Summary:** Brief description of the issue\n- **Priority:** Low, Medium, High, or Critical\n- **Assignee:** (optional) Team member to assign\n\nOr you can say something like: \"Create a Jira ticket for payment-api high error rate, priority high\"",
      };
    }

    if (userQuery.includes("notion") || userQuery.includes("note")) {
      return {
        content: "I can send notes to Notion. What would you like to document?\n\nExamples:\n- \"Send to Notion: Decision to implement rate limiting on API gateway\"\n- \"Note in Notion: Postmortem summary for yesterday's outage\"",
      };
    }

    if (userQuery.includes("slack") || userQuery.includes("post")) {
      return {
        content: "I can post messages to Slack channels. Which channel would you like to post to, and what's the message?\n\nExample: \"Post to #engineering: Deploy complete for v2.3.1\"",
      };
    }

    if (userQuery.includes("summarize") || userQuery.includes("summary") || userQuery.includes("today")) {
      return {
        content: "**Today's Engineering Activity Summary**\n\n📊 **By the Numbers:**\n- 47 events logged across all sources\n- 5 deployments (4 successful, 1 rolled back)\n- 2 incidents (both resolved)\n- 12 decision points documented\n\n🔴 **Attention Needed:**\n- payment-api showing elevated error rates\n- 3 critical security vulnerabilities pending review\n\n✅ **Wins:**\n- MTTR improved to 18 min (down from 25 min)\n- Zero P1 incidents this week",
      };
    }

    return {
      content: "I'm your Ops Agent. I can help you:\n\n**📊 Query your systems:**\n- \"What's the status of our services?\"\n- \"Show me today's activity summary\"\n- \"What's causing the high error rate?\"\n\n**📝 Generate reports:**\n- \"Generate a standup report\"\n- \"Create an executive summary\"\n\n**🔧 Take actions:**\n- \"Create a Jira ticket for...\"\n- \"Send a note to Notion\"\n- \"Post to Slack channel\"\n\nHow can I help you today?",
    };
  }
}

export class AgentService {
  private llmProvider: ILLMProvider;
  private tools: Map<string, IAgentToolExecutor> = new Map();
  private conversations: Map<string, ChatMessage[]> = new Map();

  constructor(llmProvider?: ILLMProvider) {
    this.llmProvider = llmProvider || new MockLLMProvider();
    this.registerDefaultTools();
  }

  private registerDefaultTools() {
    this.registerTool({
      name: "get_services_status",
      description: "Get the current health status of all services",
      category: "query",
      execute: async (_params, context) => {
        const critical = context.services.filter(s => s.health === "critical");
        const degraded = context.services.filter(s => s.health === "degraded");
        return {
          success: true,
          result: `Found ${critical.length} critical and ${degraded.length} degraded services`,
          data: { critical, degraded },
        };
      },
    });

    this.registerTool({
      name: "generate_report",
      description: "Generate a report (standup, executive, or stakeholder)",
      category: "report",
      execute: async (params, context) => {
        const style = params.style as string || "standup";
        return {
          success: true,
          result: `Generated ${style} report based on ${context.events.length} events`,
        };
      },
    });

    this.registerTool({
      name: "create_jira_ticket",
      description: "Create a new Jira ticket",
      category: "action",
      provider: "jira",
      execute: async (params) => {
        return {
          success: true,
          result: `Jira ticket created: ${params.summary}`,
          data: { ticketId: "MOCK-123", url: "https://jira.example.com/MOCK-123" },
        };
      },
    });

    this.registerTool({
      name: "send_to_notion",
      description: "Send a note or document to Notion",
      category: "action",
      provider: "notion",
      execute: async (params) => {
        return {
          success: true,
          result: `Note added to Notion: ${params.title || "Untitled"}`,
          data: { pageId: "mock-page-id", url: "https://notion.so/mock-page" },
        };
      },
    });

    this.registerTool({
      name: "post_to_slack",
      description: "Post a message to a Slack channel",
      category: "action",
      provider: "slack",
      execute: async (params) => {
        return {
          success: true,
          result: `Message posted to ${params.channel}`,
        };
      },
    });
  }

  registerTool(tool: IAgentToolExecutor) {
    this.tools.set(tool.name, tool);
  }

  getAvailableTools(): AgentTool[] {
    return Array.from(this.tools.values()).map(t => ({
      name: t.name,
      description: t.description,
      category: t.category,
      provider: t.provider,
      parameters: [],
    }));
  }

  async chat(request: ChatRequest, context: AgentContext): Promise<ChatResponse> {
    const conversationId = request.conversationId || uuid();
    
    const history = this.conversations.get(conversationId) || [];
    
    const userMessage: ChatMessage = {
      id: uuid(),
      role: "user",
      content: request.message,
      timestamp: new Date().toISOString(),
    };
    history.push(userMessage);

    const response = await this.llmProvider.chat(history, this.getAvailableTools());

    const toolCalls = response.toolCalls?.map(tc => ({
      tool: tc.tool,
      status: "success" as const,
      params: tc.params,
    }));

    const assistantMessage: ChatMessage = {
      id: uuid(),
      role: "assistant",
      content: response.content,
      timestamp: new Date().toISOString(),
      toolCalls,
    };
    history.push(assistantMessage);

    this.conversations.set(conversationId, history);

    return {
      message: assistantMessage,
      conversationId,
    };
  }

  getConversation(conversationId: string): ChatMessage[] {
    return this.conversations.get(conversationId) || [];
  }

  clearConversation(conversationId: string): void {
    this.conversations.delete(conversationId);
  }
}

export const agentService = new AgentService();
