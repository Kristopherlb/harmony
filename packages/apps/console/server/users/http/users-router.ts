// server/users/http/users-router.ts
// HTTP router for users context - parse/validate → use case → map response

import type { Request, Response } from "express";
import { Router as createRouter, type Router } from "express";
import { GetUserProfile } from "../application/get-user-profile";
import type { UserRepositoryPort } from "../application/ports";

export interface UsersRouterDeps {
  userRepository: UserRepositoryPort;
}

export function createUsersRouter(deps: UsersRouterDeps): Router {
  const router = createRouter();

  const getUserProfile = new GetUserProfile(deps.userRepository);

  // GET /api/users/:identifier/profile
  router.get("/:identifier/profile", async (req: Request, res: Response) => {
    try {
      const identifier = Array.isArray(req.params.identifier) ? req.params.identifier[0] : req.params.identifier;
      
      const profile = await getUserProfile.execute({ identifier });

      if (!profile) {
        return res.status(404).json({ error: "User not found" });
      }

      return res.json(profile);
    } catch (error) {
      console.error("Error fetching user profile:", error);
      return res.status(500).json({ error: "Failed to fetch user profile" });
    }
  });

  return router;
}
