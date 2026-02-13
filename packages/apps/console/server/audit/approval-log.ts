/**
 * packages/apps/console/server/audit/approval-log.ts
 * Approval event log for RESTRICTED tool usage (Phase 4.1.5).
 *
 * IMP-044: Prefer Postgres persistence when configured, with explicit fallback
 * to in-memory for local/dev.
 */

export interface ApprovalLogContext {
  incidentId?: string;
  workflowId?: string;
  draftTitle?: string;
  /** Optional context type for Phase 4.3 execution monitoring (e.g. "incident" | "workflow" | "draft"). */
  contextType?: string;
}

export interface ApprovalLogEntry {
  id: string;
  approverId: string;
  timestamp: string;
  approvedToolIds: string[];
  context?: ApprovalLogContext;
}

export interface ApprovalLogStore {
  append(entry: { approverId: string; approvedToolIds: string[]; context?: ApprovalLogContext }): Promise<ApprovalLogEntry>;
  list(limit?: number): Promise<ApprovalLogEntry[]>;
}

export class ApprovalLogValidationError extends Error {
  code: "APPROVED_TOOL_IDS_REQUIRED" | "APPROVAL_CONTEXT_REQUIRED";

  constructor(code: "APPROVED_TOOL_IDS_REQUIRED" | "APPROVAL_CONTEXT_REQUIRED", message: string) {
    super(message);
    this.name = "ApprovalLogValidationError";
    this.code = code;
  }
}

export function isApprovalLogValidationError(error: unknown): error is ApprovalLogValidationError {
  return error instanceof ApprovalLogValidationError;
}

function hasRequiredApprovalContext(context: ApprovalLogContext | undefined): boolean {
  if (!context || typeof context !== "object") return false;
  const fields = [context.workflowId, context.incidentId, context.draftTitle];
  return fields.some((value) => typeof value === "string" && value.trim().length > 0);
}

function validateApprovalLogEntry(entry: {
  approverId: string;
  approvedToolIds: string[];
  context?: ApprovalLogContext;
}): void {
  if (!Array.isArray(entry.approvedToolIds) || entry.approvedToolIds.length === 0) {
    throw new ApprovalLogValidationError("APPROVED_TOOL_IDS_REQUIRED", "approvedToolIds required and non-empty");
  }
  if (!hasRequiredApprovalContext(entry.context)) {
    throw new ApprovalLogValidationError(
      "APPROVAL_CONTEXT_REQUIRED",
      "At least one of context.workflowId, context.incidentId, or context.draftTitle is required."
    );
  }
}

function createInMemoryApprovalLogStore(): ApprovalLogStore {
  const store: ApprovalLogEntry[] = [];
  let idSeq = 0;

  function nextId(): string {
    idSeq += 1;
    return `approval-${Date.now()}-${idSeq}`;
  }

  return {
    async append(entry) {
      const record: ApprovalLogEntry = {
        id: nextId(),
        approverId: entry.approverId,
        timestamp: new Date().toISOString(),
        approvedToolIds: [...entry.approvedToolIds],
        context: entry.context,
      };
      store.push(record);
      return record;
    },

    async list(limit = 50) {
      return store
        .slice()
        .reverse()
        .slice(0, limit)
        .map((e) => ({ ...e, approvedToolIds: [...e.approvedToolIds] }));
    },
  };
}

let storeSingleton: ApprovalLogStore | null = null;

function shouldUsePostgres(): boolean {
  return process.env.REPOSITORY_MODE === "postgres" && typeof process.env.DATABASE_URL === "string" && process.env.DATABASE_URL.length > 0;
}

function getStore(): ApprovalLogStore {
  if (storeSingleton) return storeSingleton;

  if (shouldUsePostgres()) {
    // Lazy load to avoid importing drizzle when using memory mode
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PostgresApprovalLogRepository } = require("../repositories/postgres-approval-log-repository");
    storeSingleton = new PostgresApprovalLogRepository();
    return storeSingleton;
  }

  storeSingleton = createInMemoryApprovalLogStore();
  return storeSingleton;
}

export async function appendApprovalLog(entry: {
  approverId: string;
  approvedToolIds: string[];
  context?: ApprovalLogContext;
}): Promise<ApprovalLogEntry> {
  validateApprovalLogEntry(entry);
  return getStore().append(entry);
}

export async function listApprovalLog(limit = 50): Promise<ApprovalLogEntry[]> {
  return getStore().list(limit);
}
