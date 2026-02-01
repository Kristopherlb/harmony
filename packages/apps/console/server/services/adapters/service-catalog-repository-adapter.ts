// server/services/adapters/service-catalog-repository-adapter.ts
// Adapter: Adapts IServiceCatalogRepository to ServiceCatalogRepositoryPort

import type { IServiceCatalogRepository } from "../../storage";
import type { ServiceCatalogRepositoryPort } from "../application/ports";

export class ServiceCatalogRepositoryAdapter implements ServiceCatalogRepositoryPort {
  constructor(private repository: IServiceCatalogRepository) {}

  async getServices(options?: {
    teamId?: string;
    type?: string;
    health?: string;
  }) {
    return this.repository.getServices(options as any);
  }

  async getServiceById(id: string) {
    return this.repository.getServiceById(id);
  }

  async getTeams() {
    return this.repository.getTeams();
  }

  async getTeamById(id: string) {
    return this.repository.getTeamById(id);
  }
}
