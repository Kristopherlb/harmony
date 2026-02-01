// server/services/application/get-services.ts
// Use case: Get services with optional filters

import type { ServiceCatalogRepositoryPort } from "./ports";

export interface GetServicesRequest {
  teamId?: string;
  type?: string;
  health?: string;
}

import type { Service, Team } from "@shared/schema";

export interface GetServicesResponse {
  services: Service[];
  teams: Team[];
  total: number;
}

export class GetServices {
  constructor(private serviceCatalogRepository: ServiceCatalogRepositoryPort) {}

  async execute(request: GetServicesRequest): Promise<GetServicesResponse> {
    const services = await this.serviceCatalogRepository.getServices({
      teamId: request.teamId,
      type: request.type,
      health: request.health,
    });
    const teams = await this.serviceCatalogRepository.getTeams();

    return {
      services,
      teams,
      total: services.length,
    };
  }
}
