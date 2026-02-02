// server/integrations/http/integrations-router.ts
// HTTP router for integrations context - parse/validate → use case → map response

import type { Request, Response, NextFunction } from "express";
import { Router as createRouter, type Router } from "express";
import { SlackCommandSchema, type EventSource } from "@shared/schema";
import { IngestWebhookEvent } from "../application/ingest-webhook-event";
import { SyncSource } from "../application/sync-source";
import { SyncAllSources } from "../application/sync-all-sources";
import type {
  EventIngestionPort,
  SourceAdapterPort,
  ServiceClientPort,
} from "../application/ports";
import { SourceAdapterAdapter } from "../adapters/source-adapter-adapter";
import { ServiceClientAdapter } from "../adapters/service-client-adapter";
import { GetUserStats } from "../../metrics/application/get-user-stats";
import { EventRepositoryAdapter } from "../../events/adapters/event-repository-adapter";
import type { SlackAdapter, SourceAdapter } from "../../adapters";
import type { ServiceClient } from "../../clients";
import {
  createSlackInteractiveHandler,
  createSlackVerificationMiddleware,
} from "./slack-interactive-handler";

export interface IntegrationsRouterDeps {
  eventIngestion: EventIngestionPort;
  eventRepository: any; // For GetUserStats - TODO: refactor to use proper port
  slackAdapter: SlackAdapter;
  serviceClients: Record<EventSource, ServiceClient>;
  createWebhookVerificationMiddleware: (source: string) => (req: Request, res: Response, next: NextFunction) => void;
  getVerificationStatus: () => Record<string, boolean>;
  getAdapter: (source: EventSource) => SourceAdapter;
  getConfiguredClients: () => ServiceClient[];
}

function getRequiredEnvVars(source: string): string[] {
  const requirements: Record<string, string[]> = {
    slack: ["SLACK_BOT_TOKEN", "SLACK_SIGNING_SECRET"],
    gitlab: ["GITLAB_TOKEN", "GITLAB_WEBHOOK_SECRET"],
    bitbucket: ["BITBUCKET_USERNAME", "BITBUCKET_APP_PASSWORD", "BITBUCKET_WORKSPACE", "BITBUCKET_WEBHOOK_SECRET"],
    jira: ["JIRA_HOST", "JIRA_EMAIL", "JIRA_API_TOKEN", "JIRA_WEBHOOK_SECRET"],
    pagerduty: ["PAGERDUTY_API_KEY", "PAGERDUTY_WEBHOOK_SECRET"],
    circleci: ["CIRCLECI_API_TOKEN"],
  };
  return requirements[source] ?? [];
}

export function createIntegrationsRouter(deps: IntegrationsRouterDeps): Router {
  const router = createRouter();

  // Slack interactive messages (approval buttons)
  const slackSigningSecret = process.env.SLACK_SIGNING_SECRET;
  if (slackSigningSecret) {
    router.post(
      "/slack/interactive",
      createSlackVerificationMiddleware(slackSigningSecret),
      createSlackInteractiveHandler()
    );
  } else {
    // Allow unauthenticated for local development
    router.post("/slack/interactive", createSlackInteractiveHandler());
  }

  // Slack events
  router.post("/slack/events", deps.createWebhookVerificationMiddleware("slack"), async (req: Request, res: Response) => {
    try {
      const parseResult = SlackCommandSchema.safeParse(req.body);
      
      if (!parseResult.success) {
        return res.status(400).json({
          error: "Invalid Slack command payload",
          details: parseResult.error.flatten(),
        });
      }

      const slackCommand = parseResult.data;
      const text = slackCommand.text.trim();
      const parts = text.split(" ");
      const command = parts[0]?.toLowerCase();

      if (command === "status") {
        // Note: GetUserStats needs EventRepositoryPort, but we only have EventIngestionPort here
        // For now, we'll need to pass the repository separately or create a different adapter
        // This is a limitation - we should refactor GetUserStats to use a more generic port
        const getUserStats = new GetUserStats(new EventRepositoryAdapter(deps.eventRepository));
        const stats = await getUserStats.execute({ userId: slackCommand.user_id });
        return res.json({
          response_type: "ephemeral",
          blocks: [
            {
              type: "header",
              text: {
                type: "plain_text",
                text: `Stats for @${stats.username}`,
              },
            },
            {
              type: "section",
              fields: [
                {
                  type: "mrkdwn",
                  text: `*Logs this week:*\n${stats.logsThisWeek}`,
                },
                {
                  type: "mrkdwn",
                  text: `*Blockers resolved:*\n${stats.blockersResolved}`,
                },
                {
                  type: "mrkdwn",
                  text: `*Decisions logged:*\n${stats.decisionsLogged}`,
                },
                {
                  type: "mrkdwn",
                  text: `*Total events:*\n${stats.totalEvents}`,
                },
              ],
            },
          ],
        });
      }

      if (command === "report") {
        // Report generation handled by agent router
        // Slack command can call /api/agent/generate-report directly
        return res.status(501).json({ 
          error: "Report generation moved to /api/agent/generate-report endpoint",
          message: "Use the agent API endpoint for report generation"
        });
      }

      const insertEvent = deps.slackAdapter.transformToEvent(slackCommand);
      const eventResult = await deps.eventIngestion.createEvent(insertEvent);
      const blockKitResponse = deps.slackAdapter.createBlockKitResponse(insertEvent);

      return res.json({
        ...blockKitResponse,
        event_id: eventResult.id,
      });
    } catch (error) {
      console.error("Error processing Slack event:", error);
      return res.status(500).json({
        response_type: "ephemeral",
        text: "An error occurred processing your command.",
      });
    }
  });

  // Webhook endpoint
  router.post("/:source/webhook", (req: Request, res: Response, next: NextFunction) => {
    const source = Array.isArray(req.params.source) ? req.params.source[0] : req.params.source;
    if (!["gitlab", "bitbucket", "jira", "pagerduty", "circleci"].includes(source)) {
      return res.status(400).json({ error: "Invalid source" });
    }
    return deps.createWebhookVerificationMiddleware(source)(req, res, next);
  }, async (req: Request, res: Response) => {
    try {
      const source = (Array.isArray(req.params.source) ? req.params.source[0] : req.params.source) as EventSource;

      const adapter = new SourceAdapterAdapter(deps.getAdapter(source));
      const ingestWebhookEvent = new IngestWebhookEvent(adapter, deps.eventIngestion);

      const result = await ingestWebhookEvent.execute({
        source,
        payload: req.body,
      });

      return res.json({ success: result.success, event_id: result.eventId });
    } catch (error) {
      console.error(`Error processing ${req.params.source} webhook:`, error);
      return res.status(500).json({ error: "Failed to process webhook" });
    }
  });

  // Sync all sources (when mounted at /api/sync, this becomes /api/sync/all)
  router.post("/all", async (req: Request, res: Response) => {
    try {
      const configuredClients = deps.getConfiguredClients();
      
      if (configuredClients.length === 0) {
        return res.status(400).json({ 
          error: "No sources configured",
          available: Object.keys(deps.serviceClients),
        });
      }

      const serviceClientPorts: ServiceClientPort[] = configuredClients.map(
        client => new ServiceClientAdapter(client, client.source)
      );

      const syncAllSources = new SyncAllSources(serviceClientPorts, deps.eventIngestion);

      const since = req.body.since ? new Date(req.body.since) : undefined;
      const limit = req.body.limit ?? 50;

      const result = await syncAllSources.execute({
        since,
        limit,
      });

      return res.json(result);
    } catch (error) {
      console.error("Error syncing all sources:", error);
      return res.status(500).json({ error: "Failed to sync all sources" });
    }
  });

  // Sync single source (when mounted at /api/sync, this becomes /api/sync/:source)
  router.post("/:source", async (req: Request, res: Response) => {
    try {
      const source = (Array.isArray(req.params.source) ? req.params.source[0] : req.params.source) as EventSource;
      
      if (!["slack", "gitlab", "bitbucket", "jira", "pagerduty", "circleci"].includes(source)) {
        return res.status(400).json({ error: "Invalid source" });
      }

      const client = deps.serviceClients[source];
      const serviceClientPort = new ServiceClientAdapter(client, source);
      const syncSource = new SyncSource(serviceClientPort, deps.eventIngestion);
      
      const since = req.body.since ? new Date(req.body.since) : undefined;
      const limit = req.body.limit ?? 50;

      const result = await syncSource.execute({
        source,
        since,
        limit,
      });

      if (result.error) {
        return res.status(400).json({
          error: result.error,
          required: getRequiredEnvVars(source),
        });
      }

      return res.json(result);
    } catch (error) {
      console.error(`Error syncing ${req.params.source}:`, error);
      return res.status(500).json({ error: `Failed to sync ${req.params.source}` });
    }
  });

  // Integration status
  router.get("/status", async (_req: Request, res: Response) => {
    const verificationStatus = deps.getVerificationStatus();
    const clientStatus: Record<string, { configured: boolean; webhookVerified: boolean }> = {};

    for (const [source, client] of Object.entries(deps.serviceClients)) {
      clientStatus[source] = {
        configured: client.isConfigured(),
        webhookVerified: verificationStatus[source] ?? false,
      };
    }

    return res.json({ integrations: clientStatus });
  });

  return router;
}
