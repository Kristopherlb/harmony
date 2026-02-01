// server/users/adapters/user-repository-adapter.ts
// Adapter: Adapts IUserRepository to UserRepositoryPort

import type { IUserRepository } from "../../storage";
import type { UserRepositoryPort } from "../application/ports";

export class UserRepositoryAdapter implements UserRepositoryPort {
  constructor(private repository: IUserRepository) {}

  async getUserProfile(identifier: string) {
    return this.repository.getUserProfile(identifier);
  }

  async getUserProfileByUsername(username: string) {
    return this.repository.getUserProfileByUsername(username);
  }
}
