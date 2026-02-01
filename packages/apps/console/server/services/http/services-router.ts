// server/services/http/services-router.ts
// HTTP router for services context - parse/validate → use case → map response

import type { Request, Response } from "express";
import { Router as createRouter, type Router } from "express";
import { GetServices } from "../application/get-services";
import { GetServiceById } from "../application/get-service-by-id";
import type { ServiceCatalogRepositoryPort } from "../application/ports";

export interface ServicesRouterDeps {
  serviceCatalogRepository: ServiceCatalogRepositoryPort;
}

export function createServicesRouter(deps: ServicesRouterDeps): Router {
  const router = createRouter();

  const getServices = new GetServices(deps.serviceCatalogRepository);
  const getServiceById = new GetServiceById(deps.serviceCatalogRepository);

  // GET /api/services
  router.get("/", async (req: Request, res: Response) => {
    try {
      const teamId = req.query.teamId as string | undefined;
      const type = req.query.type as string | undefined;
      const health = req.query.health as string | undefined;

      const result = await getServices.execute({
        teamId,
        type,
        health,
      });

      return res.json(result);
    } catch (error) {
      console.error("Error fetching services:", error);
      return res.status(500).json({ error: "Failed to fetch services" });
    }
  });

  // GET /api/services/search?asset=...
  router.get("/search", async (req: Request, res: Response) => {
    try {
      const asset = req.query.asset as string | undefined;
      if (!asset) {
        return res.status(400).json({ error: "Asset parameter is required" });
      }

      const allServices = await getServices.execute({});
      const assetLower = asset.toLowerCase();
      
      // Search by name, tags, or ID
      const matchingServices = allServices.services.filter(service => {
        const nameMatch = service.name.toLowerCase().includes(assetLower);
        const idMatch = service.id.toLowerCase().includes(assetLower);
        const tagMatch = service.tags.some(tag => tag.toLowerCase().includes(assetLower));
        return nameMatch || idMatch || tagMatch;
      });

      // Get teams for matching services
      const teamIds = [...new Set(matchingServices.map(s => s.teamId))];
      const teams = allServices.teams.filter(t => teamIds.includes(t.id));

      return res.json({
        services: matchingServices,
        teams,
        asset,
      });
    } catch (error) {
      console.error("Error searching services:", error);
      return res.status(500).json({ error: "Failed to search services" });
    }
  });

  // GET /api/services/:id
  router.get("/:id", async (req: Request, res: Response) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await getServiceById.execute({ serviceId: id });

      return res.json(result);
    } catch (error) {
      console.error("Error fetching service:", error);
      if (error instanceof Error && error.message === "Service not found") {
        return res.status(404).json({ error: error.message });
      }
      return res.status(500).json({ error: "Failed to fetch service" });
    }
  });

  return router;
}
