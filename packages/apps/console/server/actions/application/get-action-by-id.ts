// server/actions/application/get-action-by-id.ts
// Use case: Get single action by ID

import type { Action } from "../domain/types";
import type { ActionRepositoryPort } from "./ports";

export interface GetActionByIdRequest {
  actionId: string;
}

export class GetActionById {
  constructor(private actionRepository: ActionRepositoryPort) {}

  async execute(request: GetActionByIdRequest): Promise<Action | null> {
    const action = await this.actionRepository.getActionById(request.actionId);
    return action || null;
  }
}
