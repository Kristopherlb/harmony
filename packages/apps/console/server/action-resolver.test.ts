import { describe, it, expect, beforeEach } from "vitest";
import { ActionResolver, IActionResolver } from "./action-resolver";
import type { Action, Event, UserRole, ContextType } from "@shared/schema";

describe("ActionResolver", () => {
  let resolver: IActionResolver;

  const mockActions: Action[] = [
    {
      id: "flush-redis-cache",
      name: "Flush Redis Cache",
      description: "Clear Redis cache",
      category: "remediation",
      riskLevel: "medium",
      requiredParams: [],
      requiredRoles: ["sre", "admin"],
      targetServices: ["redis", "cache"],
      contextTypes: ["incident", "infrastructure"],
    },
    {
      id: "restart-pods",
      name: "Restart Pods",
      description: "Restart Kubernetes pods",
      category: "remediation",
      riskLevel: "medium",
      requiredParams: [],
      requiredRoles: ["sre", "admin"],
      targetServices: ["kubernetes", "gateway", "api"],
      contextTypes: ["incident", "deployment_failure"],
    },
    {
      id: "scale-asg",
      name: "Scale ASG",
      description: "Scale Auto Scaling Group",
      category: "remediation",
      riskLevel: "high",
      requiredParams: [],
      requiredRoles: ["sre", "admin"],
      targetServices: ["aws", "asg", "api"],
      contextTypes: ["incident", "infrastructure"],
    },
    {
      id: "vacuum-database",
      name: "Vacuum Database",
      description: "Run VACUUM on database tables",
      category: "data",
      riskLevel: "medium",
      requiredParams: [],
      requiredRoles: ["sre", "admin"],
      targetServices: ["database", "postgres"],
      contextTypes: ["infrastructure"],
    },
    {
      id: "restart-web-app",
      name: "Restart Web App",
      description: "Restart the web application",
      category: "remediation",
      riskLevel: "low",
      requiredParams: [],
      requiredRoles: ["dev", "sre", "admin"],
      targetServices: ["web", "frontend"],
      contextTypes: ["incident", "deployment_failure"],
    },
    {
      id: "provision-dev-env",
      name: "Provision Dev Environment",
      description: "Create a new dev environment",
      category: "provisioning",
      riskLevel: "low",
      requiredParams: [],
      requiredRoles: ["dev", "sre", "admin"],
      targetServices: [],
      contextTypes: [],
    },
    {
      id: "deploy-hotfix",
      name: "Deploy Hotfix",
      description: "Deploy a hotfix to production",
      category: "deployment",
      riskLevel: "critical",
      requiredParams: [],
      requiredRoles: ["admin"],
      targetServices: ["api", "web", "gateway"],
      contextTypes: ["incident", "deployment_failure"],
    },
  ];

  beforeEach(() => {
    resolver = new ActionResolver(mockActions);
  });

  describe("resolveActionsForSignal", () => {
    it("should return actions matching service tags", () => {
      const signal: Partial<Event> = {
        id: "test-1",
        contextType: "incident",
        serviceTags: ["redis"],
        severity: "high",
      };

      const actions = resolver.resolveActionsForSignal(signal as Event, "sre");

      expect(actions).toContainEqual(expect.objectContaining({ id: "flush-redis-cache" }));
      expect(actions).not.toContainEqual(expect.objectContaining({ id: "vacuum-database" }));
    });

    it("should filter out actions not matching service tags", () => {
      const signal: Partial<Event> = {
        id: "test-2",
        contextType: "infrastructure",
        serviceTags: ["database"],
        severity: "medium",
      };

      const actions = resolver.resolveActionsForSignal(signal as Event, "sre");

      expect(actions).toContainEqual(expect.objectContaining({ id: "vacuum-database" }));
      expect(actions).not.toContainEqual(expect.objectContaining({ id: "restart-web-app" }));
      expect(actions).not.toContainEqual(expect.objectContaining({ id: "flush-redis-cache" }));
    });

    it("should return actions matching context type", () => {
      const signal: Partial<Event> = {
        id: "test-3",
        contextType: "deployment_failure",
        serviceTags: ["api"],
        severity: "critical",
      };

      const actions = resolver.resolveActionsForSignal(signal as Event, "admin");

      expect(actions).toContainEqual(expect.objectContaining({ id: "restart-pods" }));
      expect(actions).toContainEqual(expect.objectContaining({ id: "deploy-hotfix" }));
      expect(actions).not.toContainEqual(expect.objectContaining({ id: "flush-redis-cache" }));
    });

    it("should respect user role permissions for risk levels", () => {
      const signal: Partial<Event> = {
        id: "test-4",
        contextType: "incident",
        serviceTags: ["api", "gateway"],
        severity: "critical",
      };

      const devActions = resolver.resolveActionsForSignal(signal as Event, "dev");
      const sreActions = resolver.resolveActionsForSignal(signal as Event, "sre");
      const adminActions = resolver.resolveActionsForSignal(signal as Event, "admin");

      expect(devActions).not.toContainEqual(expect.objectContaining({ id: "deploy-hotfix" }));
      expect(devActions).not.toContainEqual(expect.objectContaining({ id: "scale-asg" }));
      expect(sreActions).not.toContainEqual(expect.objectContaining({ id: "deploy-hotfix" }));
      expect(sreActions).toContainEqual(expect.objectContaining({ id: "scale-asg" }));
      expect(adminActions).toContainEqual(expect.objectContaining({ id: "deploy-hotfix" }));
    });

    it("should return empty array for viewer role", () => {
      const signal: Partial<Event> = {
        id: "test-5",
        contextType: "incident",
        serviceTags: ["redis"],
        severity: "high",
      };

      const actions = resolver.resolveActionsForSignal(signal as Event, "viewer");

      expect(actions).toHaveLength(0);
    });

    it("should include global actions (no targetServices) for all signals", () => {
      const signal: Partial<Event> = {
        id: "test-6",
        contextType: "incident",
        serviceTags: ["some-random-service"],
        severity: "low",
      };

      const actions = resolver.resolveActionsForSignal(signal as Event, "dev");

      expect(actions).toContainEqual(expect.objectContaining({ id: "provision-dev-env" }));
    });

    it("should handle events with multiple service tags", () => {
      const signal: Partial<Event> = {
        id: "test-7",
        contextType: "incident",
        serviceTags: ["redis", "api", "gateway"],
        severity: "high",
      };

      const actions = resolver.resolveActionsForSignal(signal as Event, "sre");

      expect(actions).toContainEqual(expect.objectContaining({ id: "flush-redis-cache" }));
      expect(actions).toContainEqual(expect.objectContaining({ id: "restart-pods" }));
      expect(actions).toContainEqual(expect.objectContaining({ id: "scale-asg" }));
    });

    it("should sort actions by relevance score", () => {
      const signal: Partial<Event> = {
        id: "test-8",
        contextType: "incident",
        serviceTags: ["api", "gateway"],
        severity: "high",
      };

      const actions = resolver.resolveActionsForSignal(signal as Event, "sre");

      const restartPodsIndex = actions.findIndex(a => a.id === "restart-pods");
      const scaleAsgIndex = actions.findIndex(a => a.id === "scale-asg");
      expect(restartPodsIndex).toBeLessThan(scaleAsgIndex);
    });

    it("should handle events with no service tags", () => {
      const signal: Partial<Event> = {
        id: "test-9",
        contextType: "general",
        serviceTags: [],
        severity: "low",
      };

      const actions = resolver.resolveActionsForSignal(signal as Event, "dev");

      expect(actions).toContainEqual(expect.objectContaining({ id: "provision-dev-env" }));
    });

    it("should not return actions when role is not in requiredRoles", () => {
      const signal: Partial<Event> = {
        id: "test-10",
        contextType: "incident",
        serviceTags: ["redis"],
        severity: "medium",
      };

      const actions = resolver.resolveActionsForSignal(signal as Event, "dev");

      expect(actions).not.toContainEqual(expect.objectContaining({ id: "flush-redis-cache" }));
    });
  });

  describe("calculateRelevanceScore", () => {
    it("should return higher score for more matching service tags", () => {
      const action: Action = {
        id: "test-action",
        name: "Test",
        description: "Test",
        category: "remediation",
        riskLevel: "low",
        requiredParams: [],
        requiredRoles: ["dev"],
        targetServices: ["api", "gateway", "redis"],
        contextTypes: ["incident"],
      };

      const signal1: Partial<Event> = {
        contextType: "incident",
        serviceTags: ["api"],
      };

      const signal2: Partial<Event> = {
        contextType: "incident",
        serviceTags: ["api", "gateway"],
      };

      const score1 = resolver.calculateRelevanceScore(action, signal1 as Event);
      const score2 = resolver.calculateRelevanceScore(action, signal2 as Event);

      expect(score2).toBeGreaterThan(score1);
    });

    it("should add bonus for matching context type", () => {
      const action: Action = {
        id: "test-action",
        name: "Test",
        description: "Test",
        category: "remediation",
        riskLevel: "low",
        requiredParams: [],
        requiredRoles: ["dev"],
        targetServices: ["api"],
        contextTypes: ["incident"],
      };

      const signalMatch: Partial<Event> = {
        contextType: "incident",
        serviceTags: ["api"],
      };

      const signalNoMatch: Partial<Event> = {
        contextType: "general",
        serviceTags: ["api"],
      };

      const scoreMatch = resolver.calculateRelevanceScore(action, signalMatch as Event);
      const scoreNoMatch = resolver.calculateRelevanceScore(action, signalNoMatch as Event);

      expect(scoreMatch).toBeGreaterThan(scoreNoMatch);
    });
  });

  describe("getActionsForContextType", () => {
    it("should return all actions for a specific context type", () => {
      const actions = resolver.getActionsForContextType("incident", "sre");

      expect(actions.length).toBeGreaterThan(0);
      actions.forEach(action => {
        expect(action.contextTypes?.includes("incident") || action.contextTypes?.length === 0).toBe(true);
      });
    });

    it("should filter by role permissions", () => {
      const devActions = resolver.getActionsForContextType("incident", "dev");
      const adminActions = resolver.getActionsForContextType("incident", "admin");

      expect(adminActions.length).toBeGreaterThanOrEqual(devActions.length);
    });
  });
});
