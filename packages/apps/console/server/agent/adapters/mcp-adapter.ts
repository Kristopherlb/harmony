import { z } from "zod";

// Basic schema for a tool exposed by MCP
export interface McpTool {
    name: string;
    description?: string;
    inputSchema: Record<string, any>;
}

export interface IMcpClient {
    getAvailableTools(): Promise<McpTool[]>;
}

// TODO: Replace with real Client using @modelcontextprotocol/sdk when available
export class MockMcpClient implements IMcpClient {
    async getAvailableTools(): Promise<McpTool[]> {
        // Simulating tools that would come from the 'harmony' MCP server
        return [
            {
                name: "jira_get_issues",
                description: "Fetch issues from Jira using JQL",
                inputSchema: {
                    type: "object",
                    properties: {
                        jql: { type: "string" },
                        limit: { type: "number" }
                    },
                    required: ["jql"]
                }
            },
            {
                name: "slack_send_message",
                description: "Send a message to a Slack channel",
                inputSchema: {
                    type: "object",
                    properties: {
                        channel: { type: "string" },
                        message: { type: "string" }
                    },
                    required: ["channel", "message"]
                }
            },
            {
                name: "github_create_issue",
                description: "Create a new issue in a GitHub repository",
                inputSchema: {
                    type: "object",
                    properties: {
                        owner: { type: "string" },
                        repo: { type: "string" },
                        title: { type: "string" },
                        body: { type: "string" }
                    },
                    required: ["owner", "repo", "title"]
                }
            }
        ];
    }
}

// Singleton instance for now
export const mcpClient = new MockMcpClient();
