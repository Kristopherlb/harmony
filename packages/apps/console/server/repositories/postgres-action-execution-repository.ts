import { eq, desc, asc, and } from "drizzle-orm";
import { getDb } from "../db";
import { workflowExecutions } from "@shared/db-schema";
import { v4 as uuidv4 } from "uuid";
import type { WorkflowExecution } from "@shared/schema";

type DbWorkflowExecutionRow = typeof workflowExecutions.$inferSelect;

function normalizeContext(
  context: unknown
): WorkflowExecution["context"] | undefined {
  if (!context || typeof context !== "object") return undefined;
  const obj = context as Record<string, unknown>;
  return Object.keys(obj).length > 0 ? (obj as any) : undefined;
}

function mapDbRowToShared(row: DbWorkflowExecutionRow): WorkflowExecution {
  return {
    id: row.id,
    runId: row.runId,
    actionId: row.actionId,
    actionName: row.actionName,
    status: row.status as WorkflowExecution["status"],
    params: (row.params as Record<string, unknown>) ?? {},
    reasoning: row.reasoning,
    executedBy: row.executedBy,
    executedByUsername: row.executedByUsername,
    startedAt: row.startedAt.toISOString(),
    completedAt: row.completedAt?.toISOString(),
    approvedBy: row.approvedBy ?? undefined,
    approvedAt: row.approvedAt?.toISOString(),
    output: (row.output as string[]) ?? [],
    error: row.error ?? undefined,
    context: normalizeContext(row.context),
  };
}

function deriveIncidentIdFromContext(context?: WorkflowExecution["context"]): string | undefined {
  if (!context) return undefined;
  return (
    context.incidentId ??
    (context.contextType === "incident" ? context.eventId : undefined)
  );
}

function incidentIdFromContext(context?: WorkflowExecution["context"]): string | undefined {
  return deriveIncidentIdFromContext(context);
}

function matchesScope(
  ex: WorkflowExecution,
  scope: { eventId?: string; incidentId?: string; serviceTag?: string } | undefined
): boolean {
  if (!scope) return true;
  if (scope.eventId && ex.context?.eventId !== scope.eventId) return false;
  if (scope.incidentId && incidentIdFromContext(ex.context) !== scope.incidentId) return false;
  if (scope.serviceTag) {
    const tags = ex.context?.serviceTags ?? [];
    if (!tags.includes(scope.serviceTag)) return false;
  }
  return true;
}

/**
 * Postgres-backed execution store for Actions (IMP-031).
 * 
 * NOTE: This repository is infrastructure-only and should only be wired from composition.
 */
export class PostgresActionExecutionRepository {
  async createExecution(execution: Omit<WorkflowExecution, "id">): Promise<WorkflowExecution> {
    const db = getDb();
    const id = uuidv4();

    const incidentId = deriveIncidentIdFromContext(execution.context);
    const eventId = execution.context?.eventId;

    const [row] = await db
      .insert(workflowExecutions)
      .values({
        id,
        runId: execution.runId,
        actionId: execution.actionId,
        actionName: execution.actionName,
        status: execution.status,
        params: execution.params ?? {},
        reasoning: execution.reasoning ?? "",
        executedBy: execution.executedBy,
        executedByUsername: execution.executedByUsername,
        startedAt: new Date(execution.startedAt),
        completedAt: execution.completedAt ? new Date(execution.completedAt) : null,
        approvedBy: execution.approvedBy ?? null,
        approvedAt: execution.approvedAt ? new Date(execution.approvedAt) : null,
        output: execution.output ?? [],
        error: execution.error ?? null,
        context: execution.context ?? {},
        incidentId: incidentId ?? null,
        eventId: eventId ?? null,
      })
      .returning();

    return mapDbRowToShared(row);
  }

  async getExecution(id: string): Promise<WorkflowExecution | undefined> {
    const db = getDb();
    const rows = await db
      .select()
      .from(workflowExecutions)
      .where(eq(workflowExecutions.id, id))
      .limit(1);
    const row = rows[0];
    return row ? mapDbRowToShared(row) : undefined;
  }

  async getExecutionByRunId(runId: string): Promise<WorkflowExecution | undefined> {
    const db = getDb();
    const rows = await db
      .select()
      .from(workflowExecutions)
      .where(eq(workflowExecutions.runId, runId))
      .limit(1);
    const row = rows[0];
    return row ? mapDbRowToShared(row) : undefined;
  }

  async updateExecution(
    id: string,
    updates: Partial<WorkflowExecution>
  ): Promise<WorkflowExecution | undefined> {
    const db = getDb();

    const updateValues: Partial<typeof workflowExecutions.$inferInsert> = {};
    if (updates.status !== undefined) updateValues.status = updates.status;
    if (updates.params !== undefined) updateValues.params = updates.params;
    if (updates.reasoning !== undefined) updateValues.reasoning = updates.reasoning;
    if (updates.completedAt !== undefined) {
      updateValues.completedAt = updates.completedAt ? new Date(updates.completedAt) : null;
    }
    if (updates.approvedBy !== undefined) updateValues.approvedBy = updates.approvedBy ?? null;
    if (updates.approvedAt !== undefined) {
      updateValues.approvedAt = updates.approvedAt ? new Date(updates.approvedAt) : null;
    }
    if (updates.output !== undefined) updateValues.output = updates.output ?? [];
    if (updates.error !== undefined) updateValues.error = updates.error ?? null;
    if (updates.context !== undefined) {
      updateValues.context = updates.context ?? {};
      updateValues.incidentId = deriveIncidentIdFromContext(updates.context) ?? null;
      updateValues.eventId = updates.context?.eventId ?? null;
    }

    const [row] = await db
      .update(workflowExecutions)
      .set(updateValues)
      .where(eq(workflowExecutions.id, id))
      .returning();

    return row ? mapDbRowToShared(row) : undefined;
  }

  async getExecutionsByUser(userId: string): Promise<WorkflowExecution[]> {
    const db = getDb();
    const rows = await db
      .select()
      .from(workflowExecutions)
      .where(eq(workflowExecutions.executedBy, userId))
      .orderBy(desc(workflowExecutions.startedAt));
    return rows.map(mapDbRowToShared);
  }

  async getPendingApprovals(scope?: { eventId?: string; incidentId?: string; serviceTag?: string }): Promise<WorkflowExecution[]> {
    const db = getDb();
    const conditions = [eq(workflowExecutions.status, "pending_approval")];
    if (scope?.incidentId) conditions.push(eq(workflowExecutions.incidentId, scope.incidentId));
    if (scope?.eventId) conditions.push(eq(workflowExecutions.eventId, scope.eventId));

    const rows = await db
      .select()
      .from(workflowExecutions)
      .where(and(...conditions))
      .orderBy(asc(workflowExecutions.startedAt));
    return rows.map(mapDbRowToShared).filter((ex) => matchesScope(ex, scope));
  }

  async getRecentExecutions(
    limit: number = 20,
    scope?: { eventId?: string; incidentId?: string; serviceTag?: string }
  ): Promise<WorkflowExecution[]> {
    const db = getDb();
    const conditions = [];
    if (scope?.incidentId) conditions.push(eq(workflowExecutions.incidentId, scope.incidentId));
    if (scope?.eventId) conditions.push(eq(workflowExecutions.eventId, scope.eventId));

    const base = db.select().from(workflowExecutions);
    const q = conditions.length > 0 ? base.where(and(...conditions)) : base;
    const rows = await q.orderBy(desc(workflowExecutions.startedAt)).limit(limit);
    return rows.map(mapDbRowToShared).filter((ex) => matchesScope(ex, scope));
  }
}

