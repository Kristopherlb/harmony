// server/composition.ts
// Composition root: builds dependencies and wires adapters

import { createRepository } from "./storage";
import { generateSeedData } from "./infrastructure/seed";
import { SeedableActionRepository } from "./action-repository";
import { MockWorkflowEngine } from "./workflow-engine";
import { SafeSqlRunner } from "./sql-runner";
import { createAgentService } from "./agent-service";
import { AgentService } from "./services/agent-service";
import { SlackAdapter, getAdapter } from "./adapters";
import { createServiceClients, getConfiguredClients } from "./clients";
import { getSecurityAdapter, isValidSecurityTool } from "./security-adapters";
import { createWebhookVerificationMiddleware, getVerificationStatus } from "./webhook-verification";
import { HarmonyMcpToolService } from "./agent/services/harmony-mcp-tool-service";
import type { AppDeps } from "./types/deps";

export function createAppDeps(): AppDeps {
  // Build repositories
  const seedData = generateSeedData();
  const repository = createRepository(seedData);
  const actionRepository = new SeedableActionRepository();
  
  // Build services
  const workflowEngine = new MockWorkflowEngine();
  
  // SQL runner needs audit callback - wire it to repository
  const sqlRunner = new SafeSqlRunner(async (event) => {
    await repository.createEvent(event);
  });
  
  const agentService = createAgentService(); // Report generation
  const chatAgentService = new AgentService(); // Chat/LLM
  const mcpToolService = new HarmonyMcpToolService({ includeBlueprints: true, version: "1" });
  
  // Build adapters
  const slackAdapter = new SlackAdapter();
  const serviceClients = createServiceClients();
  
  // Webhook verification functions
  const webhookMiddleware = createWebhookVerificationMiddleware;
  const verificationStatus = getVerificationStatus;
  
  return {
    repository,
    actionRepository,
    workflowEngine,
    sqlRunner,
    agentService,
    chatAgentService,
    mcpToolService,
    slackAdapter,
    serviceClients,
    createWebhookVerificationMiddleware: webhookMiddleware,
    getVerificationStatus: verificationStatus,
    getAdapter,
    getSecurityAdapter,
    isValidSecurityTool,
    getConfiguredClients,
  };
}
