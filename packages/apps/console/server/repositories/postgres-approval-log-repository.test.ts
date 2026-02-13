import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { DbFixture } from "../test/db-fixture";

/**
 * Contract tests for Postgres-backed approval logging (IMP-044).
 *
 * Skipped when DATABASE_URL is not configured.
 */
const shouldSkip = !process.env.DATABASE_URL;
describe.skipIf(shouldSkip)("PostgresApprovalLogRepository", () => {
  let fixture: DbFixture;

  beforeAll(async () => {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL must be set for Postgres approval log tests");
    fixture = new DbFixture(databaseUrl);
  });

  afterAll(async () => {
    await fixture.close();
  });

  beforeEach(async () => {
    await fixture.truncateTables();
  });

  it("persists and lists approval log entries", async () => {
    const { PostgresApprovalLogRepository } = await import("./postgres-approval-log-repository");
    const repo = new PostgresApprovalLogRepository();

    const created = await repo.append({
      approverId: "test-user",
      approvedToolIds: ["tool.restricted"],
      context: { draftTitle: "Test draft", incidentId: "incident-1", workflowId: "wf-1", contextType: "draft" },
    });

    expect(created).toHaveProperty("id");
    expect(created.approverId).toBe("test-user");
    expect(created.approvedToolIds).toEqual(["tool.restricted"]);
    expect(created).toHaveProperty("timestamp");
    expect(created.context).toMatchObject({ draftTitle: "Test draft", incidentId: "incident-1", workflowId: "wf-1", contextType: "draft" });

    const entries = await repo.list(50);
    expect(entries.length).toBeGreaterThanOrEqual(1);
    expect(entries[0].id).toBe(created.id);
  });
});

