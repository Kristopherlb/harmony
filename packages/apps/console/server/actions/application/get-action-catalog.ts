// server/actions/application/get-action-catalog.ts
// Use case: Get action catalog with RBAC filtering

import type { Action, ActionCategory, UserRole } from "../domain/types";
import type { ActionRepositoryPort, PermissionServicePort } from "./ports";

export interface GetActionCatalogRequest {
  userId: string;
  role: UserRole;
}

export interface GetActionCatalogResponse {
  actions: Action[];
  categories: Array<{
    id: ActionCategory;
    name: string;
    count: number;
  }>;
}

export class GetActionCatalog {
  constructor(
    private actionRepository: ActionRepositoryPort,
    private permissionService: PermissionServicePort
  ) {}

  async execute(request: GetActionCatalogRequest): Promise<GetActionCatalogResponse> {
    const allActions = await this.actionRepository.getActions();

    const accessibleActions = allActions.filter((action) =>
      this.permissionService.canExecuteAction(request.role, action)
    );

    const categories = [
      { id: "provisioning" as const, name: "Provisioning", count: 0 },
      { id: "remediation" as const, name: "Remediation", count: 0 },
      { id: "data" as const, name: "Data Operations", count: 0 },
      { id: "deployment" as const, name: "Deployment", count: 0 },
    ];

    for (const action of accessibleActions) {
      const cat = categories.find((c) => c.id === action.category);
      if (cat) cat.count++;
    }

    return {
      actions: accessibleActions,
      categories: categories.filter((c) => c.count > 0),
    };
  }
}
