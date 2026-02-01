import type { Action, Event, UserRole, ContextType, RiskLevel } from "@shared/schema";

export interface IActionResolver {
  resolveActionsForSignal(signal: Event, userRole: UserRole): Action[];
  calculateRelevanceScore(action: Action, signal: Event): number;
  getActionsForContextType(contextType: ContextType, userRole: UserRole): Action[];
}

const RISK_LEVEL_PERMISSIONS: Record<UserRole, RiskLevel[]> = {
  viewer: [],
  dev: ["low", "medium"],
  sre: ["low", "medium", "high"],
  admin: ["low", "medium", "high", "critical"],
};

export class ActionResolver implements IActionResolver {
  private actions: Action[];

  constructor(actions: Action[]) {
    this.actions = actions;
  }

  resolveActionsForSignal(signal: Event, userRole: UserRole): Action[] {
    const allowedRiskLevels = RISK_LEVEL_PERMISSIONS[userRole];
    
    if (allowedRiskLevels.length === 0) {
      return [];
    }

    const matchingActions = this.actions.filter(action => {
      if (!action.requiredRoles.includes(userRole)) {
        return false;
      }
      if (!allowedRiskLevels.includes(action.riskLevel)) {
        return false;
      }
      const isGlobalAction = !action.targetServices || action.targetServices.length === 0;
      if (isGlobalAction) {
        return true;
      }
      const hasMatchingService = action.targetServices.some(
        service => signal.serviceTags?.includes(service)
      );
      const hasMatchingContext = !action.contextTypes || 
        action.contextTypes.length === 0 || 
        action.contextTypes.includes(signal.contextType);

      return hasMatchingService && hasMatchingContext;
    });

    return matchingActions.sort((a, b) => {
      const scoreA = this.calculateRelevanceScore(a, signal);
      const scoreB = this.calculateRelevanceScore(b, signal);
      return scoreB - scoreA;
    });
  }

  calculateRelevanceScore(action: Action, signal: Event): number {
    let score = 0;

    if (action.targetServices && signal.serviceTags) {
      const matchingServices = action.targetServices.filter(
        service => signal.serviceTags.includes(service)
      );
      score += matchingServices.length * 10;
    }

    if (action.contextTypes && action.contextTypes.includes(signal.contextType)) {
      score += 20;
    }

    const isGlobalAction = !action.targetServices || action.targetServices.length === 0;
    if (isGlobalAction) {
      score -= 5;
    }

    return score;
  }

  getActionsForContextType(contextType: ContextType, userRole: UserRole): Action[] {
    const allowedRiskLevels = RISK_LEVEL_PERMISSIONS[userRole];

    return this.actions.filter(action => {
      if (!action.requiredRoles.includes(userRole)) {
        return false;
      }
      if (!allowedRiskLevels.includes(action.riskLevel)) {
        return false;
      }
      const matchesContext = !action.contextTypes || 
        action.contextTypes.length === 0 || 
        action.contextTypes.includes(contextType);

      return matchesContext;
    });
  }
}
