import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { DbFixture } from "../test/db-fixture";
import { PostgresActionExecutionRepository } from "./postgres-action-execution-repository";
import type { WorkflowExecution } from "@shared/schema";

const shouldSkip = !process.env.DATABASE_URL;

describe.skipIf(shouldSkip)("PostgresActionExecutionRepository - Contract Tests", () => {
  let fixture: DbFixture;
  let repo: PostgresActionExecutionRepository;

  beforeAll(async () => {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("DATABASE_URL must be set for Postgres execution repository tests");
    }
    fixture = new DbFixture(databaseUrl);
  });

  afterAll(async () => {
    await fixture.close();
  });

  beforeEach(async () => {
    repo = new PostgresActionExecutionRepository();
    await fixture.truncateTables();
  });

  it("should create → fetch → update an execution", async () => {
    const created = await repo.createExecution({
      runId: "run-1",
      actionId: "action-1",
      actionName: "Test Action",
      status: "pending_approval",
      params: { foo: "bar" },
      reasoning: "Because tests",
      executedBy: "user-1",
      executedByUsername: "alice",
      startedAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
      output: [],
      context: {
        eventId: "11111111-1111-1111-1111-111111111111",
        incidentId: "22222222-2222-2222-2222-222222222222",
        contextType: "incident",
        serviceTags: ["api"],
      },
    });

    expect(created.id).toBeDefined();
    expect(created.runId).toBe("run-1");
    expect(created.context?.incidentId).toBe("22222222-2222-2222-2222-222222222222");

    const fetched = await repo.getExecution(created.id);
    expect(fetched?.id).toBe(created.id);
    expect(fetched?.runId).toBe("run-1");

    const updated = await repo.updateExecution(created.id, {
      status: "running",
      approvedBy: "approver-1",
      approvedAt: new Date("2026-01-01T00:10:00.000Z").toISOString(),
    });

    expect(updated?.status).toBe("running");
    expect(updated?.approvedBy).toBe("approver-1");
    expect(updated?.approvedAt).toBe("2026-01-01T00:10:00.000Z");
  });

  it("should query pending approvals ordered by startedAt ASC", async () => {
    const execs: Array<Omit<WorkflowExecution, "id">> = [
      {
        runId: "run-a",
        actionId: "action-1",
        actionName: "A",
        status: "pending_approval",
        params: {},
        reasoning: "Reason A",
        executedBy: "user-1",
        executedByUsername: "alice",
        startedAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
        output: [],
      },
      {
        runId: "run-b",
        actionId: "action-2",
        actionName: "B",
        status: "pending_approval",
        params: {},
        reasoning: "Reason B",
        executedBy: "user-2",
        executedByUsername: "bob",
        startedAt: new Date("2026-01-01T00:05:00.000Z").toISOString(),
        output: [],
      },
    ];

    await repo.createExecution(execs[1]);
    await repo.createExecution(execs[0]);

    const pending = await repo.getPendingApprovals();
    expect(pending).toHaveLength(2);
    expect(pending[0].runId).toBe("run-a");
    expect(pending[1].runId).toBe("run-b");
  });
});

