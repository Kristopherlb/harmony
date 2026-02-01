// server/users/application/ports.ts
// Application ports for users context

import type { UserProfile } from "@shared/schema";

export interface UserRepositoryPort {
  getUserProfile(identifier: string): Promise<UserProfile | undefined>;
  getUserProfileByUsername(username: string): Promise<UserProfile | undefined>;
}
