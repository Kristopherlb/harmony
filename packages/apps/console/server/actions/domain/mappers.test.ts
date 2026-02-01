// server/actions/domain/mappers.test.ts
// Tests for action domain mappers

import { describe, it, expect } from "vitest";
import {
  toDomainAction,
  toSharedAction,
  toDomainWorkflowExecution,
  toSharedWorkflowExecution,
  toDomainExecuteActionRequest,
  toSharedExecuteActionRequest,
} from "./mappers";
import type { Action, WorkflowExecution, ExecuteActionRequest } from "./types";

describe("Action Mappers", () => {
  const sharedAction = {
    id: "action-1",
    name: "Provision Dev Environment",
    description: "Creates a new development environment",
    category: "provisioning" as const,
    riskLevel: "medium" as const,
    requiredParams: [
      {
        name: "environment",
        type: "string" as const,
        label: "Environment Name",
        required: true,
      },
    ],
    workflowId: "workflow-1",
    icon: "server",
    estimatedDuration: "5 minutes",
    requiredRoles: ["sre" as const, "admin" as const],
    targetServices: ["api-service"],
    contextTypes: ["infrastructure" as const],
  };

  it("should convert shared Action to domain Action", () => {
    const domain = toDomainAction(sharedAction);
    expect(domain.id).toBe(sharedAction.id);
    expect(domain.name).toBe(sharedAction.name);
    expect(domain.category).toBe(sharedAction.category);
    expect(domain.requiredParams).toEqual(sharedAction.requiredParams);
  });

  it("should convert domain Action to shared Action", () => {
    const domain: Action = {
      id: "action-1",
      name: "Provision Dev Environment",
      description: "Creates a new development environment",
      category: "provisioning",
      riskLevel: "medium",
      requiredParams: [
        {
          name: "environment",
          type: "string",
          label: "Environment Name",
          required: true,
        },
      ],
      workflowId: "workflow-1",
      icon: "server",
      estimatedDuration: "5 minutes",
      requiredRoles: ["sre", "admin"],
      targetServices: ["api-service"],
      contextTypes: ["infrastructure"],
    };

    const shared = toSharedAction(domain);
    expect(shared.id).toBe(domain.id);
    expect(shared.name).toBe(domain.name);
    expect(shared.category).toBe(domain.category);
  });

  it("should round-trip Action through mappers", () => {
    const domain = toDomainAction(sharedAction);
    const backToShared = toSharedAction(domain);
    expect(backToShared).toEqual(sharedAction);
  });
});

describe("WorkflowExecution Mappers", () => {
  const sharedExecution = {
    id: "exec-1",
    runId: "run-123",
    actionId: "action-1",
    actionName: "Test Action",
    status: "running" as const,
    params: { env: "dev" },
    reasoning: "Testing the system",
    executedBy: "user-1",
    executedByUsername: "testuser",
    startedAt: "2024-01-01T00:00:00Z",
    completedAt: undefined,
    approvedBy: undefined,
    approvedAt: undefined,
    output: ["Step 1 completed"],
    error: undefined,
  };

  it("should convert shared WorkflowExecution to domain WorkflowExecution", () => {
    const domain = toDomainWorkflowExecution(sharedExecution);
    expect(domain.id).toBe(sharedExecution.id);
    expect(domain.runId).toBe(sharedExecution.runId);
    expect(domain.startedAt).toBeInstanceOf(Date);
    expect(domain.startedAt.getTime()).toBe(new Date(sharedExecution.startedAt).getTime());
  });

  it("should convert domain WorkflowExecution to shared WorkflowExecution", () => {
    const domain: WorkflowExecution = {
      id: "exec-1",
      runId: "run-123",
      actionId: "action-1",
      actionName: "Test Action",
      status: "running",
      params: { env: "dev" },
      reasoning: "Testing the system",
      executedBy: "user-1",
      executedByUsername: "testuser",
      startedAt: new Date("2024-01-01T00:00:00Z"),
      completedAt: undefined,
      approvedBy: undefined,
      approvedAt: undefined,
      output: ["Step 1 completed"],
      error: undefined,
    };

    const shared = toSharedWorkflowExecution(domain);
    expect(shared.id).toBe(domain.id);
    expect(shared.startedAt).toBe(domain.startedAt.toISOString());
  });

  it("should round-trip WorkflowExecution through mappers", () => {
    const domain = toDomainWorkflowExecution(sharedExecution);
    const backToShared = toSharedWorkflowExecution(domain);
    expect(backToShared.id).toBe(sharedExecution.id);
    // Timestamp format may differ (Z vs .000Z), so just check it's a valid ISO string
    expect(backToShared.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/);
    expect(new Date(backToShared.startedAt).toISOString()).toBe(new Date(sharedExecution.startedAt).toISOString());
  });
});

describe("ExecuteActionRequest Mappers", () => {
  const sharedRequest = {
    actionId: "action-1",
    params: { environment: "dev" },
    reasoning: "Need to test new feature",
  };

  it("should convert shared ExecuteActionRequest to domain ExecuteActionRequest", () => {
    const domain = toDomainExecuteActionRequest(sharedRequest);
    expect(domain.actionId).toBe(sharedRequest.actionId);
    expect(domain.params).toEqual(sharedRequest.params);
    expect(domain.reasoning).toBe(sharedRequest.reasoning);
  });

  it("should convert domain ExecuteActionRequest to shared ExecuteActionRequest", () => {
    const domain: ExecuteActionRequest = {
      actionId: "action-1",
      params: { environment: "dev" },
      reasoning: "Need to test new feature",
    };

    const shared = toSharedExecuteActionRequest(domain);
    expect(shared).toEqual(domain);
  });

  it("should round-trip ExecuteActionRequest through mappers", () => {
    const domain = toDomainExecuteActionRequest(sharedRequest);
    const backToShared = toSharedExecuteActionRequest(domain);
    expect(backToShared).toEqual(sharedRequest);
  });
});
