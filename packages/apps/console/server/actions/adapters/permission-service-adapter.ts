// server/actions/adapters/permission-service-adapter.ts
// Adapter: Adapts IActionRepository permission methods to PermissionServicePort with domain mapping

import type { IActionRepository } from "../../action-repository";
import type { PermissionServicePort } from "../application/ports";
import type { Action, UserRole } from "../domain/types";
import { toSharedAction } from "../domain/mappers";

export class PermissionServiceAdapter implements PermissionServicePort {
  constructor(private repository: IActionRepository) {}

  getPermissions(role: UserRole) {
    return this.repository.getPermissions(role);
  }

  canExecuteAction(role: UserRole, action: Action) {
    // Convert domain action to shared action for repository (which still uses shared types)
    const sharedAction = toSharedAction(action);
    return this.repository.canExecuteAction(role, sharedAction);
  }

  canApprove(role: UserRole) {
    return this.repository.canApprove(role);
  }
}
