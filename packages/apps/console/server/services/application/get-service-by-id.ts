// server/services/application/get-service-by-id.ts
// Use case: Get service by ID with dependencies and dependents

import type { ServiceCatalogRepositoryPort } from "./ports";
import type { Service, Team } from "@shared/schema";

export interface GetServiceByIdRequest {
  serviceId: string;
}

export interface GetServiceByIdResponse {
  service: Service;
  team: Team | undefined;
  dependencies: Service[];
  dependents: Service[];
}

export class GetServiceById {
  constructor(private serviceCatalogRepository: ServiceCatalogRepositoryPort) {}

  async execute(request: GetServiceByIdRequest): Promise<GetServiceByIdResponse> {
    const service = await this.serviceCatalogRepository.getServiceById(request.serviceId);
    
    if (!service) {
      throw new Error("Service not found");
    }

    const team = await this.serviceCatalogRepository.getTeamById(service.teamId);
    const allServices = await this.serviceCatalogRepository.getServices();

    const dependencies = allServices.filter(s => service.dependencies.includes(s.id));
    const dependents = allServices.filter(s => s.dependencies.includes(service.id));

    return {
      service,
      team,
      dependencies,
      dependents,
    };
  }
}
