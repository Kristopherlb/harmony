import { desc } from "drizzle-orm";
import { getDb } from "../db";
import { approvalLogs } from "@shared/db-schema";
import type { ApprovalLogContext, ApprovalLogEntry } from "../audit/approval-log";

type DbApprovalLogRow = typeof approvalLogs.$inferSelect;

function normalizeContext(context: unknown): ApprovalLogContext | undefined {
  if (!context || typeof context !== "object") return undefined;
  const obj = context as Record<string, unknown>;
  return Object.keys(obj).length > 0 ? (obj as any) : undefined;
}

function mapDbRowToEntry(row: DbApprovalLogRow): ApprovalLogEntry {
  return {
    id: row.id,
    approverId: row.approverId,
    timestamp: row.timestamp.toISOString(),
    approvedToolIds: (row.approvedToolIds as string[]) ?? [],
    context: normalizeContext(row.context),
  };
}

/**
 * Postgres-backed approval event log store (IMP-044).
 *
 * NOTE: Infrastructure-only; choose via composition/env gating.
 */
export class PostgresApprovalLogRepository {
  async append(entry: {
    approverId: string;
    approvedToolIds: string[];
    context?: ApprovalLogContext;
  }): Promise<ApprovalLogEntry> {
    const db = getDb();

    const context = entry.context ?? undefined;
    const [row] = await db
      .insert(approvalLogs)
      .values({
        approverId: entry.approverId,
        approvedToolIds: entry.approvedToolIds ?? [],
        context: context ?? {},
        incidentId: context?.incidentId ?? null,
        workflowId: context?.workflowId ?? null,
        contextType: context?.contextType ?? null,
        draftTitle: context?.draftTitle ?? null,
      })
      .returning();

    return mapDbRowToEntry(row);
  }

  async list(limit = 50): Promise<ApprovalLogEntry[]> {
    const db = getDb();
    const rows = await db
      .select()
      .from(approvalLogs)
      .orderBy(desc(approvalLogs.timestamp))
      .limit(limit);
    return rows.map(mapDbRowToEntry);
  }
}

