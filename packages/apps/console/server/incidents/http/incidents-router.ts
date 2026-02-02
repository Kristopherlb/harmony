// server/incidents/http/incidents-router.ts
// HTTP router for incident-scoped convenience endpoints

import type { Request, Response } from "express";
import { Router as createRouter, type Router } from "express";
import { IncidentTimelineResponseSchema } from "@shared/schema";
import type { IActivityRepository } from "../../storage";
import type { IActionRepository } from "../../action-repository";

export interface IncidentsRouterDeps {
  repository: IActivityRepository;
  actionRepository: IActionRepository;
}

function canonicalIncidentIdForEvent(event: { id: string; incidentId?: string; contextType?: string }): string | undefined {
  if (event.incidentId) return event.incidentId;
  if (event.contextType === "incident") return event.id;
  return undefined;
}

export function createIncidentsRouter(deps: IncidentsRouterDeps): Router {
  const router = createRouter();

  // GET /api/incidents/:incidentId/timeline
  // Convenience endpoint: returns incident-scoped events + executions without the client needing to join.
  router.get("/:incidentId/timeline", async (req: Request, res: Response) => {
    try {
      const incidentId = Array.isArray(req.params.incidentId) ? req.params.incidentId[0] : req.params.incidentId;

      // NOTE: this is intentionally conservative (bounded) and uses existing repository surfaces.
      const { events } = await deps.repository.getEvents({ page: 1, pageSize: 500 });
      const scopedEvents = events.filter((e) => canonicalIncidentIdForEvent(e) === incidentId);

      const executions = await deps.actionRepository.getRecentExecutions(500, { incidentId });

      const responseBody = IncidentTimelineResponseSchema.parse({
        incidentId,
        events: scopedEvents,
        executions,
      });

      return res.json(responseBody);
    } catch (error) {
      console.error("Error fetching incident timeline:", error);
      return res.status(500).json({ error: "Failed to fetch incident timeline" });
    }
  });

  return router;
}

