// server/types/deps.ts
// AppDeps: Minimal dependencies for route modules
// Phase 1: Inject repositories and services directly
// Future phases: Replace with use cases/ports

import type { IActivityRepository, IProjectRepository, ISecurityRepository, ICommentRepository, IUserRepository, IServiceCatalogRepository } from "../storage";
import type { IActionRepository } from "../action-repository";
import type { IWorkflowEngine } from "../workflow-engine";
import type { ISqlRunner } from "../sql-runner";
import type { IAgentService } from "../agent-service";
import type { AgentService } from "../services/agent-service";
import type { HarmonyMcpToolService } from "../agent/services/harmony-mcp-tool-service";
import type { SourceAdapter, SlackAdapter } from "../adapters";
import type { ServiceClient } from "../clients";
import type { EventSource, SecurityTool } from "@shared/schema";
import type { RequestHandler } from "express";

export interface AppDeps {
  // Repositories
  repository: IActivityRepository & IProjectRepository & ISecurityRepository & ICommentRepository & IUserRepository & IServiceCatalogRepository;
  actionRepository: IActionRepository;
  
  // Services
  workflowEngine: IWorkflowEngine;
  sqlRunner: ISqlRunner;
  agentService: IAgentService; // Report generation service
  chatAgentService: AgentService; // Chat/LLM service
  mcpToolService: HarmonyMcpToolService;
  
  // Adapters (needed for webhook/transform operations)
  slackAdapter: SlackAdapter; // Specific type for createBlockKitResponse
  serviceClients: Record<EventSource, ServiceClient>;
  
  // Webhook verification (needed for middleware)
  createWebhookVerificationMiddleware: (source: string) => RequestHandler;
  getVerificationStatus: () => Record<string, boolean>;
  
  // Adapter lookup (needed for webhook routes - will be replaced with use cases in later phases)
  getAdapter: (source: EventSource) => SourceAdapter;
  getSecurityAdapter: (tool: SecurityTool) => { transformToFinding: (payload: unknown) => { title: string; status: string; severity: string; tool: string; asset: string; detectedAt: string } | null };
  isValidSecurityTool: (tool: string) => tool is SecurityTool;
  getConfiguredClients: () => ServiceClient[];
}
