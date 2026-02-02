import { describe, it, expect, beforeEach } from "vitest";
import { MockWorkflowEngine } from "./workflow-engine";
import { SeedableActionRepository } from "./action-repository";
import { SafeSqlRunner } from "./sql-runner";
import type { Action, Event, UserRole } from "@shared/schema";

describe("MockWorkflowEngine", () => {
  let engine: MockWorkflowEngine;
  let repository: SeedableActionRepository;

  beforeEach(() => {
    engine = new MockWorkflowEngine();
    engine.clearAll();
    repository = new SeedableActionRepository();
  });

  describe("startWorkflow", () => {
    it("should start a low-risk action immediately without approval", async () => {
      const action = await repository.getActionById("provision-dev-env");
      expect(action).toBeDefined();

      const result = await engine.startWorkflow(
        action!,
        {
          actionId: action!.id,
          params: { envName: "test-env", region: "us-east-1" },
          reasoning: "Need a new dev environment for testing",
        },
        "user-123",
        "testuser"
      );

      expect(result.runId).toMatch(/^run-/);
      expect(result.status).toBe("running");
      expect(result.requiresApproval).toBe(false);
    });

    it("should require approval for high-risk actions", async () => {
      const action = await repository.getActionById("scale-asg");
      expect(action).toBeDefined();
      expect(action!.riskLevel).toBe("high");

      const result = await engine.startWorkflow(
        action!,
        {
          actionId: action!.id,
          params: { asgName: "api-server-asg", desiredCapacity: 4 },
          reasoning: "Scaling up for traffic spike",
        },
        "user-123",
        "testuser"
      );

      expect(result.runId).toMatch(/^run-/);
      expect(result.status).toBe("pending_approval");
      expect(result.requiresApproval).toBe(true);
    });

    it("should require approval for critical-risk actions", async () => {
      const action = await repository.getActionById("drop-database");
      expect(action).toBeDefined();
      expect(action!.riskLevel).toBe("critical");

      const result = await engine.startWorkflow(
        action!,
        {
          actionId: action!.id,
          params: { database: "test_db", confirmName: "test_db" },
          reasoning: "Cleaning up old test database after migration",
        },
        "user-123",
        "testuser"
      );

      expect(result.status).toBe("pending_approval");
      expect(result.requiresApproval).toBe(true);
    });

    it("should throw error for missing required parameters", async () => {
      const action = await repository.getActionById("provision-dev-env");

      await expect(
        engine.startWorkflow(
          action!,
          {
            actionId: action!.id,
            params: { envName: "test-env" }, // missing region
            reasoning: "Testing validation",
          },
          "user-123",
          "testuser"
        )
      ).rejects.toThrow("Missing required parameter: region");
    });

    it("should throw error for invalid select options", async () => {
      const action = await repository.getActionById("provision-dev-env");

      await expect(
        engine.startWorkflow(
          action!,
          {
            actionId: action!.id,
            params: { envName: "test-env", region: "invalid-region" },
            reasoning: "Testing validation",
          },
          "user-123",
          "testuser"
        )
      ).rejects.toThrow("must be one of");
    });

    it("should throw error for invalid email parameters", async () => {
      const action: Action = {
        id: "test-action",
        name: "Test",
        description: "Test",
        category: "data",
        riskLevel: "low",
        requiredParams: [
          { name: "email", type: "email", label: "Email", required: true },
        ],
        requiredRoles: ["dev", "sre", "admin"],
      };

      await expect(
        engine.startWorkflow(
          action,
          {
            actionId: action.id,
            params: { email: "invalid" },
            reasoning: "Testing validation",
          },
          "user-123",
          "testuser"
        )
      ).rejects.toThrow("must be a valid email");
    });
  });

  describe("approveWorkflow", () => {
    it("should approve a pending workflow and start execution", async () => {
      const action = await repository.getActionById("scale-asg");

      const startResult = await engine.startWorkflow(
        action!,
        {
          actionId: action!.id,
          params: { asgName: "api-server-asg", desiredCapacity: 4 },
          reasoning: "Scaling for increased traffic",
        },
        "user-123",
        "testuser"
      );

      expect(startResult.status).toBe("pending_approval");

      const approveResult = await engine.approveWorkflow(startResult.runId, "approver-456");
      expect(approveResult).toBe(true);

      const status = await engine.getWorkflowStatus(startResult.runId);
      expect(status).toBeDefined();
      expect(status!.status).toBe("approved");
      expect(status!.output.some(line => line.includes("Approved by: approver-456"))).toBe(true);
    });

    it("should reject a pending workflow", async () => {
      const action = await repository.getActionById("drop-database");

      const startResult = await engine.startWorkflow(
        action!,
        {
          actionId: action!.id,
          params: { database: "prod_db", confirmName: "prod_db" },
          reasoning: "Need to drop this database immediately",
        },
        "user-123",
        "testuser"
      );

      const rejectResult = await engine.rejectWorkflow(
        startResult.runId,
        "approver-456",
        "Cannot drop production database"
      );
      expect(rejectResult).toBe(true);

      const status = await engine.getWorkflowStatus(startResult.runId);
      expect(status!.status).toBe("rejected");
      expect(status!.output.some(line => line.includes("Rejected by: approver-456"))).toBe(true);
      expect(status!.output.some(line => line.includes("Cannot drop production database"))).toBe(true);
    });

    it("should not approve already running workflow", async () => {
      const action = await repository.getActionById("provision-dev-env");

      const startResult = await engine.startWorkflow(
        action!,
        {
          actionId: action!.id,
          params: { envName: "test", region: "us-east-1" },
          reasoning: "Testing approval workflow",
        },
        "user-123",
        "testuser"
      );

      expect(startResult.status).toBe("running");

      const approveResult = await engine.approveWorkflow(startResult.runId, "approver-456");
      expect(approveResult).toBe(false);
    });
  });

  describe("cancelWorkflow", () => {
    it("should cancel a running workflow", async () => {
      const action = await repository.getActionById("provision-dev-env");

      const startResult = await engine.startWorkflow(
        action!,
        {
          actionId: action!.id,
          params: { envName: "test", region: "us-east-1" },
          reasoning: "Testing cancellation workflow",
        },
        "user-123",
        "testuser"
      );

      const cancelResult = await engine.cancelWorkflow(startResult.runId);
      expect(cancelResult).toBe(true);

      const status = await engine.getWorkflowStatus(startResult.runId);
      expect(status!.status).toBe("cancelled");
    });

    it("should return false for non-existent workflow", async () => {
      const result = await engine.cancelWorkflow("non-existent");
      expect(result).toBe(false);
    });
  });
});

describe("SeedableActionRepository", () => {
  let repository: SeedableActionRepository;

  beforeEach(() => {
    repository = new SeedableActionRepository();
    repository.clearExecutions();
  });

  describe("Action Catalog", () => {
    it("should return all actions", async () => {
      const actions = await repository.getActions();
      expect(actions.length).toBeGreaterThan(0);
      expect(actions).toContainEqual(expect.objectContaining({ id: "provision-dev-env" }));
      expect(actions).toContainEqual(expect.objectContaining({ id: "drop-database" }));
    });

    it("should filter actions by category", async () => {
      const remediation = await repository.getActionsByCategory("remediation");
      // Phase 5 adds runbook-backed remediation actions; keep this assertion resilient.
      expect(remediation.length).toBeGreaterThanOrEqual(4);
      expect(remediation.every((a) => a.category === "remediation")).toBe(true);
    });

    it("should get action by ID", async () => {
      const action = await repository.getActionById("restart-pods");
      expect(action).toBeDefined();
      expect(action!.name).toBe("Restart Pods");
      expect(action!.riskLevel).toBe("medium");
    });
  });

  describe("RBAC Permissions", () => {
    it("should allow admin to execute any action", () => {
      const allActions = [
        { id: "1", riskLevel: "low" as const, requiredRoles: ["admin" as const] },
        { id: "2", riskLevel: "critical" as const, requiredRoles: ["admin" as const] },
      ];

      for (const action of allActions) {
        expect(repository.canExecuteAction("admin", action as Action)).toBe(true);
      }
    });

    it("should prevent viewer from executing any action", async () => {
      const actions = await repository.getActions();
      for (const action of actions) {
        expect(repository.canExecuteAction("viewer", action)).toBe(false);
      }
    });

    it("should allow dev to execute low/medium risk actions only", async () => {
      const provisionAction = await repository.getActionById("provision-dev-env");
      expect(repository.canExecuteAction("dev", provisionAction!)).toBe(true);

      const scaleAction = await repository.getActionById("scale-asg");
      expect(repository.canExecuteAction("dev", scaleAction!)).toBe(false);

      const dropAction = await repository.getActionById("drop-database");
      expect(repository.canExecuteAction("dev", dropAction!)).toBe(false);
    });

    it("should allow SRE to execute up to high risk actions", async () => {
      const scaleAction = await repository.getActionById("scale-asg");
      expect(repository.canExecuteAction("sre", scaleAction!)).toBe(true);

      const dropAction = await repository.getActionById("drop-database");
      expect(repository.canExecuteAction("sre", dropAction!)).toBe(false);
    });

    it("should allow SRE and admin to approve actions", () => {
      expect(repository.canApprove("viewer")).toBe(false);
      expect(repository.canApprove("dev")).toBe(false);
      expect(repository.canApprove("sre")).toBe(true);
      expect(repository.canApprove("admin")).toBe(true);
    });

    it("should respect action-specific role requirements", async () => {
      const restartPods = await repository.getActionById("restart-pods");
      expect(restartPods!.requiredRoles).toContain("sre");
      expect(restartPods!.requiredRoles).not.toContain("dev");

      const devHasRole = restartPods!.requiredRoles.includes("dev");
      expect(devHasRole).toBe(false);
    });
  });

  describe("Execution Management", () => {
    it("should create and retrieve executions", async () => {
      const execution = await repository.createExecution({
        runId: "run-123",
        actionId: "provision-dev-env",
        actionName: "Provision Dev Environment",
        status: "running",
        params: { envName: "test" },
        reasoning: "Testing",
        executedBy: "user-123",
        executedByUsername: "testuser",
        startedAt: new Date().toISOString(),
      });

      expect(execution.id).toBeDefined();

      const retrieved = await repository.getExecution(execution.id);
      expect(retrieved).toEqual(execution);
    });

    it("should get executions by run ID", async () => {
      const execution = await repository.createExecution({
        runId: "run-unique-456",
        actionId: "test",
        actionName: "Test",
        status: "pending",
        params: {},
        reasoning: "Testing",
        executedBy: "user-123",
        executedByUsername: "testuser",
        startedAt: new Date().toISOString(),
      });

      const byRunId = await repository.getExecutionByRunId("run-unique-456");
      expect(byRunId).toEqual(execution);
    });

    it("should update execution status", async () => {
      const execution = await repository.createExecution({
        runId: "run-789",
        actionId: "test",
        actionName: "Test",
        status: "pending_approval",
        params: {},
        reasoning: "Testing",
        executedBy: "user-123",
        executedByUsername: "testuser",
        startedAt: new Date().toISOString(),
      });

      const updated = await repository.updateExecution(execution.id, {
        status: "approved",
        approvedBy: "approver-456",
        approvedAt: new Date().toISOString(),
      });

      expect(updated!.status).toBe("approved");
      expect(updated!.approvedBy).toBe("approver-456");
    });

    it("should get pending approvals", async () => {
      await repository.createExecution({
        runId: "run-pending-1",
        actionId: "test",
        actionName: "Test 1",
        status: "pending_approval",
        params: {},
        reasoning: "Testing",
        executedBy: "user-123",
        executedByUsername: "testuser",
        startedAt: new Date().toISOString(),
      });

      await repository.createExecution({
        runId: "run-running-1",
        actionId: "test",
        actionName: "Test 2",
        status: "running",
        params: {},
        reasoning: "Testing",
        executedBy: "user-123",
        executedByUsername: "testuser",
        startedAt: new Date().toISOString(),
      });

      const pending = await repository.getPendingApprovals();
      expect(pending.length).toBe(1);
      expect(pending[0].runId).toBe("run-pending-1");
    });
  });

  describe("Query Templates", () => {
    it("should return all query templates", async () => {
      const templates = await repository.getQueryTemplates();
      expect(templates.length).toBe(4);
    });

    it("should get template by ID", async () => {
      const template = await repository.getQueryTemplateById("query-user-by-email");
      expect(template).toBeDefined();
      expect(template!.name).toBe("Query User by Email");
      expect(template!.params[0].type).toBe("email");
    });
  });
});

describe("SafeSqlRunner", () => {
  let runner: SafeSqlRunner;
  let auditEvents: Omit<Event, "id">[];

  beforeEach(() => {
    auditEvents = [];
    runner = new SafeSqlRunner(async (event) => {
      auditEvents.push(event);
    });
  });

  describe("Query Execution", () => {
    it("should execute query-user-by-email template", async () => {
      const result = await runner.executeQuery(
        { templateId: "query-user-by-email", params: { email: "alice@company.com" } },
        "user-123",
        "testuser",
        "dev"
      );

      expect(result.rowCount).toBe(1);
      expect(result.rows[0]).toMatchObject({
        id: "U001",
        username: "alice",
        email: "alice@company.com",
      });
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    });

    it("should execute query-user-by-id template", async () => {
      const result = await runner.executeQuery(
        { templateId: "query-user-by-id", params: { userId: "U002" } },
        "user-123",
        "testuser",
        "sre"
      );

      expect(result.rowCount).toBe(1);
      expect(result.rows[0].username).toBe("bob");
    });

    it("should execute count-events-by-source template", async () => {
      const result = await runner.executeQuery(
        {
          templateId: "count-events-by-source",
          params: { startDate: "2024-01-01", endDate: "2024-12-31" },
        },
        "user-123",
        "testuser",
        "admin"
      );

      expect(result.rowCount).toBe(5);
      expect(result.columns).toContain("source");
      expect(result.columns).toContain("count");
    });

    it("should return empty result for non-matching queries", async () => {
      const result = await runner.executeQuery(
        { templateId: "query-user-by-email", params: { email: "nonexistent@company.com" } },
        "user-123",
        "testuser",
        "dev"
      );

      expect(result.rowCount).toBe(0);
      expect(result.rows).toEqual([]);
    });
  });

  describe("Audit Logging", () => {
    it("should log audit event on query execution", async () => {
      await runner.executeQuery(
        { templateId: "query-user-by-email", params: { email: "test@company.com" } },
        "user-123",
        "testuser",
        "dev"
      );

      expect(auditEvents.length).toBe(1);
      expect(auditEvents[0].type).toBe("log");
      expect(auditEvents[0].source).toBe("jira");
      expect(auditEvents[0].payload).toMatchObject({
        queryType: "sql_runner",
        templateId: "query-user-by-email",
      });
    });

    it("should mask email addresses in audit logs", async () => {
      await runner.executeQuery(
        { templateId: "query-user-by-email", params: { email: "sensitive@company.com" } },
        "user-123",
        "testuser",
        "dev"
      );

      const payload = auditEvents[0].payload as any;
      expect(payload.params.email).toBe("se***@company.com");
    });
  });

  describe("Permission Checking", () => {
    it("should throw error for viewer role", async () => {
      await expect(
        runner.executeQuery(
          { templateId: "query-user-by-email", params: { email: "test@company.com" } },
          "user-123",
          "testuser",
          "viewer"
        )
      ).rejects.toThrow("Insufficient permissions");
    });

    it("should allow dev, sre, and admin roles", async () => {
      const roles: UserRole[] = ["dev", "sre", "admin"];

      for (const role of roles) {
        const result = await runner.executeQuery(
          { templateId: "query-user-by-email", params: { email: "alice@company.com" } },
          "user-123",
          "testuser",
          role
        );
        expect(result.templateId).toBe("query-user-by-email");
      }
    });
  });

  describe("Input Validation", () => {
    it("should throw error for missing required parameters", async () => {
      await expect(
        runner.executeQuery(
          { templateId: "query-user-by-email", params: {} },
          "user-123",
          "testuser",
          "dev"
        )
      ).rejects.toThrow("Missing required parameter: email");
    });

    it("should throw error for invalid email format", async () => {
      await expect(
        runner.executeQuery(
          { templateId: "query-user-by-email", params: { email: "invalid" } },
          "user-123",
          "testuser",
          "dev"
        )
      ).rejects.toThrow("must be a valid email");
    });

    it("should throw error for non-existent template", async () => {
      await expect(
        runner.executeQuery(
          { templateId: "non-existent-template", params: {} },
          "user-123",
          "testuser",
          "dev"
        )
      ).rejects.toThrow("Query template not found");
    });
  });

  describe("SQL Injection Prevention", () => {
    it("should reject inputs with SQL injection characters", async () => {
      await expect(
        runner.executeQuery(
          { templateId: "query-user-by-id", params: { userId: "U001'; DROP TABLE users;--" } },
          "user-123",
          "testuser",
          "dev"
        )
      ).rejects.toThrow("contains invalid characters");
    });

    it("should reject inputs with quotes", async () => {
      await expect(
        runner.executeQuery(
          { templateId: "query-user-by-id", params: { userId: 'U001" OR "1"="1' } },
          "user-123",
          "testuser",
          "dev"
        )
      ).rejects.toThrow("contains invalid characters");
    });
  });

  describe("Template Access", () => {
    it("should filter templates by role", async () => {
      const devTemplates = await runner.getTemplates("dev");
      expect(devTemplates.length).toBe(4);

      const viewerTemplates = await runner.getTemplates("viewer");
      expect(viewerTemplates.length).toBe(0);
    });
  });
});

describe("Critical Action Approval Flow (TDD Case)", () => {
  let engine: MockWorkflowEngine;
  let repository: SeedableActionRepository;

  beforeEach(() => {
    engine = new MockWorkflowEngine();
    engine.clearAll();
    repository = new SeedableActionRepository();
    repository.clearExecutions();
  });

  it("should return PENDING_APPROVAL status when triggering Drop Database action", async () => {
    const dropDatabaseAction = await repository.getActionById("drop-database");
    expect(dropDatabaseAction).toBeDefined();
    expect(dropDatabaseAction!.riskLevel).toBe("critical");

    const result = await engine.startWorkflow(
      dropDatabaseAction!,
      {
        actionId: "drop-database",
        params: { database: "test_db", confirmName: "test_db" },
        reasoning: "Cleaning up obsolete test database after successful migration to new schema",
      },
      "user-sre-123",
      "sre-alice"
    );

    expect(result.status).toBe("pending_approval");
    expect(result.requiresApproval).toBe(true);

    const workflowStatus = await engine.getWorkflowStatus(result.runId);
    expect(workflowStatus).toBeDefined();
    expect(workflowStatus!.status).toBe("pending_approval");
    expect(workflowStatus!.output.some(line => line.includes("approval"))).toBe(true);
  });

  it("should transition to running after approval", async () => {
    const dropDatabaseAction = await repository.getActionById("drop-database");

    const startResult = await engine.startWorkflow(
      dropDatabaseAction!,
      {
        actionId: "drop-database",
        params: { database: "test_db", confirmName: "test_db" },
        reasoning: "Required for compliance - removing deprecated data",
      },
      "user-123",
      "requester"
    );

    expect(startResult.status).toBe("pending_approval");

    const approved = await engine.approveWorkflow(startResult.runId, "admin-456");
    expect(approved).toBe(true);

    const status = await engine.getWorkflowStatus(startResult.runId);
    expect(status!.status).toBe("approved");
  });

  it("should not execute critical action without admin role permission", async () => {
    const dropDatabaseAction = await repository.getActionById("drop-database");

    const canDevExecute = repository.canExecuteAction("dev", dropDatabaseAction!);
    expect(canDevExecute).toBe(false);

    const canSreExecute = repository.canExecuteAction("sre", dropDatabaseAction!);
    expect(canSreExecute).toBe(false);

    const canAdminExecute = repository.canExecuteAction("admin", dropDatabaseAction!);
    expect(canAdminExecute).toBe(true);
  });

  it("should track full approval lifecycle", async () => {
    const deployHotfix = await repository.getActionById("deploy-hotfix");
    expect(deployHotfix!.riskLevel).toBe("critical");

    const startResult = await engine.startWorkflow(
      deployHotfix!,
      {
        actionId: "deploy-hotfix",
        params: {
          service: "api",
          version: "v2.4.1-hotfix",
          rollbackVersion: "v2.4.0",
          jiraTicket: "OPS-1234",
        },
        reasoning: "Critical security patch for CVE-2024-1234",
      },
      "sre-123",
      "sre-bob"
    );

    expect(startResult.status).toBe("pending_approval");

    const execution = await repository.createExecution({
      runId: startResult.runId,
      actionId: deployHotfix!.id,
      actionName: deployHotfix!.name,
      status: "pending_approval",
      params: {
        service: "api",
        version: "v2.4.1-hotfix",
        rollbackVersion: "v2.4.0",
        jiraTicket: "OPS-1234",
      },
      reasoning: "Critical security patch for CVE-2024-1234",
      executedBy: "sre-123",
      executedByUsername: "sre-bob",
      startedAt: new Date().toISOString(),
    });

    expect(execution.status).toBe("pending_approval");

    const pending = await repository.getPendingApprovals();
    expect(pending).toContainEqual(expect.objectContaining({ id: execution.id }));

    await engine.approveWorkflow(startResult.runId, "admin-456");
    await repository.updateExecution(execution.id, {
      status: "running",
      approvedBy: "admin-456",
      approvedAt: new Date().toISOString(),
    });

    const updated = await repository.getExecution(execution.id);
    expect(updated!.status).toBe("running");
    expect(updated!.approvedBy).toBe("admin-456");

    const pendingAfter = await repository.getPendingApprovals();
    expect(pendingAfter).not.toContainEqual(expect.objectContaining({ id: execution.id }));
  });
});
