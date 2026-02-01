// server/users/application/get-user-profile.ts
// Use case: Get user profile by identifier or username

import type { UserRepositoryPort } from "./ports";

export interface GetUserProfileRequest {
  identifier: string;
}

export interface GetUserProfileResponse {
  userId: string;
  username: string;
  avatar?: string;
  email?: string;
  role?: string;
  department?: string;
  stats: {
    userId: string;
    username: string;
    logsThisWeek: number;
    blockersResolved: number;
    decisionsLogged: number;
    totalEvents: number;
    openBlockers: number;
    openPRs: number;
    openTickets: number;
    openAlerts: number;
    avgResponseTime?: number;
  };
  recentEvents: Array<{
    id: string;
    timestamp: string;
    source: string;
    type: string;
    payload: Record<string, unknown>;
    severity: string;
    userId?: string;
    username?: string;
    message: string;
    resolved: boolean;
    resolvedAt?: string;
    externalLink?: string;
    contextType: string;
    serviceTags: string[];
  }>;
  assignedItems: Array<{
    id: string;
    timestamp: string;
    source: string;
    type: string;
    payload: Record<string, unknown>;
    severity: string;
    userId?: string;
    username?: string;
    message: string;
    resolved: boolean;
    resolvedAt?: string;
    externalLink?: string;
    contextType: string;
    serviceTags: string[];
  }>;
}

export class GetUserProfile {
  constructor(private userRepository: UserRepositoryPort) {}

  async execute(request: GetUserProfileRequest): Promise<GetUserProfileResponse | null> {
    let profile = await this.userRepository.getUserProfile(request.identifier);
    if (!profile) {
      profile = await this.userRepository.getUserProfileByUsername(request.identifier);
    }

    if (!profile) {
      return null;
    }

    return profile;
  }
}
