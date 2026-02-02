// server/routes.ts
// Thin aggregator: mounts context routers

import type { Express, Request, Response } from "express";
import { Router } from "express";
import type { Server } from "http";
import type { AppDeps } from "./types/deps";
import { createActionsRouter, type ActionsRouterDeps } from "./actions/http/actions-router";
import { createEventsRouter, type EventsRouterDeps } from "./events/http/events-router";
import { createMetricsRouter, type MetricsRouterDeps } from "./metrics/http/metrics-router";
import { createIntegrationsRouter, type IntegrationsRouterDeps } from "./integrations/http/integrations-router";
import { createSecurityRouter, type SecurityRouterDeps } from "./security/http/security-router";
import { createAgentRouter, type AgentRouterDeps } from "./agent/http/agent-router";
import { createSqlRouter, type SqlRouterDeps } from "./sql/http/sql-router";
import { createServicesRouter, type ServicesRouterDeps } from "./services/http/services-router";
import { createUsersRouter, type UsersRouterDeps } from "./users/http/users-router";
import { workflowsRouter } from "./http/workflows-router";
import { createChatRouter } from "./routers/chat-router";
import { createMcpToolsRouter } from "./routers/mcp-tools-router";
import { createWorkbenchRouter } from "./routers/workbench-router";
import { createRunbooksRouter } from "./runbooks/http/runbooks-router";
import { createIncidentsRouter } from "./incidents/http/incidents-router";
import { ActionRepositoryAdapter } from "./actions/adapters/action-repository-adapter";
import { WorkflowEngineAdapter } from "./actions/adapters/workflow-engine-adapter";
import { PermissionServiceAdapter } from "./actions/adapters/permission-service-adapter";
import { EventIngestionAdapter } from "./actions/adapters/event-ingestion-adapter";
import { EventRepositoryAdapter } from "./events/adapters/event-repository-adapter";
// Note: EventRepositoryAdapter returns domain Event types (Date timestamps)
// Ports now use domain types, so this is correct

export async function registerRoutes(
  httpServer: Server,
  app: Express,
  deps: AppDeps
): Promise<Server> {

  const {
    repository,
    actionRepository,
    workflowEngine,
    sqlRunner,
    agentService,
    chatAgentService,
    mcpToolService,
    slackAdapter,
    serviceClients,
    createWebhookVerificationMiddleware,
    getVerificationStatus,
    getAdapter,
    getSecurityAdapter,
    isValidSecurityTool,
    getConfiguredClients,
  } = deps;

  // Actions router
  const actionsDeps: ActionsRouterDeps = {
    actionRepository: new ActionRepositoryAdapter(actionRepository),
    workflowEngine: new WorkflowEngineAdapter(workflowEngine),
    permissionService: new PermissionServiceAdapter(actionRepository),
    eventIngestion: new EventIngestionAdapter(repository),
  };
  app.use("/api/actions", createActionsRouter(actionsDeps));

  // Events router
  const eventRepositoryAdapter = new EventRepositoryAdapter(repository);
  const eventsDeps: EventsRouterDeps = {
    eventRepository: eventRepositoryAdapter,
    repository: repository as any,
  };
  app.use("/api/events", createEventsRouter(eventsDeps));
  app.use("/api/activity", createEventsRouter(eventsDeps)); // Keep /api/activity/stream for backward compatibility

  // Metrics router
  const metricsDeps: MetricsRouterDeps = {
    eventRepository: eventRepositoryAdapter,
  };
  app.use("/api/metrics", createMetricsRouter(metricsDeps));

  // Integrations router
  const { EventIngestionAdapter: IntegrationsEventIngestionAdapter } = await import("./integrations/adapters/event-ingestion-adapter");
  const integrationsDeps: IntegrationsRouterDeps = {
    eventIngestion: new IntegrationsEventIngestionAdapter(repository),
    eventRepository: repository,
    slackAdapter,
    serviceClients,
    createWebhookVerificationMiddleware,
    getVerificationStatus,
    getAdapter,
    getConfiguredClients,
  };
  app.use("/api/integrations", createIntegrationsRouter(integrationsDeps));
  // Mount sync routes at /api/sync for backward compatibility
  app.use("/api/sync", createIntegrationsRouter(integrationsDeps));

  // Security router
  const { SecurityRepositoryAdapter } = await import("./security/adapters/security-repository-adapter");
  const securityDeps: SecurityRouterDeps = {
    securityRepository: new SecurityRepositoryAdapter(repository as any),
    getSecurityAdapter,
    isValidSecurityTool,
  };
  app.use("/api/security", createSecurityRouter(securityDeps));
  app.use("/api/webhooks/security", createSecurityRouter(securityDeps));

  // Agent router (consolidated report + chat)
  const { ReportGenerationAdapter } = await import("./agent/adapters/report-generation-adapter");
  const { ChatAgentAdapter } = await import("./agent/adapters/chat-agent-adapter");
  const { ServiceCatalogRepositoryAdapter: AgentServiceCatalogAdapter } = await import("./services/adapters/service-catalog-repository-adapter");
  const { GetDORAMetrics } = await import("./metrics/application/get-dora-metrics");

  const agentDeps: AgentRouterDeps = {
    reportGeneration: new ReportGenerationAdapter(agentService),
    chatAgent: new ChatAgentAdapter(chatAgentService),
    eventRepository: eventRepositoryAdapter,
    serviceCatalogRepository: new AgentServiceCatalogAdapter(repository as any),
    metricsPort: {
      getDORAMetrics: async () => {
        const getDORAMetrics = new GetDORAMetrics(eventRepositoryAdapter);
        return getDORAMetrics.execute();
      },
    },
  };
  app.use("/api/agent", createAgentRouter(agentDeps));

  // SQL router
  const { QueryTemplateRepositoryAdapter } = await import("./sql/adapters/query-template-repository-adapter");
  const { SqlRunnerAdapter } = await import("./sql/adapters/sql-runner-adapter");
  const sqlDeps: SqlRouterDeps = {
    queryTemplateRepository: new QueryTemplateRepositoryAdapter(actionRepository),
    sqlRunner: new SqlRunnerAdapter(sqlRunner),
  };
  app.use("/api/sql", createSqlRouter(sqlDeps));

  // Services router
  const { ServiceCatalogRepositoryAdapter } = await import("./services/adapters/service-catalog-repository-adapter");
  const servicesDeps: ServicesRouterDeps = {
    serviceCatalogRepository: new ServiceCatalogRepositoryAdapter(repository as any),
  };
  app.use("/api/services", createServicesRouter(servicesDeps));

  // Teams router - separate mount to avoid /api/teams/teams
  const teamsRouter = Router();
  teamsRouter.get("/", async (_req: Request, res: Response) => {
    try {
      const teams = await servicesDeps.serviceCatalogRepository.getTeams();
      return res.json({ teams });
    } catch (error) {
      console.error("Error fetching teams:", error);
      return res.status(500).json({ error: "Failed to fetch teams" });
    }
  });
  app.use("/api/teams", teamsRouter);

  // Vercel AI SDK Chat Router
  app.use("/api", createChatRouter({ mcpToolService }));

  // Harmony MCP tool catalog (for UI + agent discovery)
  app.use("/api/mcp", createMcpToolsRouter({ mcpToolService }));

  // Workbench session launcher proxy (Swagger/GraphiQL/JQL launch URLs)
  app.use("/api/workbench", createWorkbenchRouter());

  // Users router
  const { UserRepositoryAdapter } = await import("./users/adapters/user-repository-adapter");
  const usersDeps: UsersRouterDeps = {
    userRepository: new UserRepositoryAdapter(repository as any),
  };
  app.use("/api/users", createUsersRouter(usersDeps));

  // Workflows router (Temporal)
  app.use("/api/workflows", workflowsRouter);

  // Runbooks (repo-local markdown)
  app.use("/api/runbooks", createRunbooksRouter());

  // Incidents (convenience endpoints)
  app.use("/api/incidents", createIncidentsRouter({ repository, actionRepository }));

  return httpServer;
}
