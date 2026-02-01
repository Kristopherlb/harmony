// server/metrics/http/metrics-router.ts
// HTTP router for metrics context

import type { Request, Response } from "express";
import { Router as createRouter, type Router } from "express";
import { DORAMetricsSchema, UserStatsSchema } from "@shared/schema";
import { GetDORAMetrics } from "../application/get-dora-metrics";
import { GetUserStats } from "../application/get-user-stats";
import type { EventRepositoryPort } from "../../events/application/ports";

export interface MetricsRouterDeps {
  eventRepository: EventRepositoryPort;
}

export function createMetricsRouter(deps: MetricsRouterDeps): Router {
  const router = createRouter();

  const getDORAMetrics = new GetDORAMetrics(deps.eventRepository);
  const getUserStats = new GetUserStats(deps.eventRepository);

  router.get("/dora", async (_req: Request, res: Response) => {
    try {
      const metrics = await getDORAMetrics.execute();
      const validated = DORAMetricsSchema.parse(metrics);
      return res.json(validated);
    } catch (error) {
      console.error("Error calculating DORA metrics:", error);
      return res.status(500).json({ error: "Failed to calculate metrics" });
    }
  });

  router.get("/users/:userId/stats", async (req: Request, res: Response) => {
    try {
      const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
      const stats = await getUserStats.execute({ userId });
      const validated = UserStatsSchema.parse(stats);
      return res.json(validated);
    } catch (error) {
      console.error("Error fetching user stats:", error);
      return res.status(500).json({ error: "Failed to fetch user stats" });
    }
  });

  return router;
}
