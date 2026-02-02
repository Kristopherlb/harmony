/**
 * packages/apps/console/server/audit/approval-log.ts
 * Approval event log for RESTRICTED tool usage (Phase 4.1.5).
 * In-memory store; can be replaced with DB persistence later.
 */

export interface ApprovalLogContext {
  incidentId?: string;
  workflowId?: string;
  draftTitle?: string;
}

export interface ApprovalLogEntry {
  id: string;
  approverId: string;
  timestamp: string;
  approvedToolIds: string[];
  context?: ApprovalLogContext;
}

const store: ApprovalLogEntry[] = [];
let idSeq = 0;

function nextId(): string {
  idSeq += 1;
  return `approval-${Date.now()}-${idSeq}`;
}

export function appendApprovalLog(entry: {
  approverId: string;
  approvedToolIds: string[];
  context?: ApprovalLogContext;
}): ApprovalLogEntry {
  const record: ApprovalLogEntry = {
    id: nextId(),
    approverId: entry.approverId,
    timestamp: new Date().toISOString(),
    approvedToolIds: [...entry.approvedToolIds],
    context: entry.context,
  };
  store.push(record);
  return record;
}

export function listApprovalLog(limit = 50): ApprovalLogEntry[] {
  return store
    .slice()
    .reverse()
    .slice(0, limit)
    .map((e) => ({ ...e, approvedToolIds: [...e.approvedToolIds] }));
}
