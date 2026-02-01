// server/services/application/ports.ts
// Application ports for services context

import type { Service, Team } from "@shared/schema";

export interface ServiceCatalogRepositoryPort {
  getServices(options?: {
    teamId?: string;
    type?: string;
    health?: string;
  }): Promise<Service[]>;
  getServiceById(id: string): Promise<Service | undefined>;
  getTeams(): Promise<Team[]>;
  getTeamById(id: string): Promise<Team | undefined>;
}
