/**
 * packages/apps/console/client/src/lib/workbench-telemetry.ts
 *
 * Workbench UX telemetry emitter (Phase 4.5).
 *
 * Emits events defined in `docs/workbench-analytics-events.md` to the Console server,
 * which converts them to Prometheus series (for Grafana dashboards and SLOs).
 */
import { v4 as uuidv4 } from "uuid";

const SESSION_STORAGE_KEY = "golden.workbench.session_id";
const DEFAULT_ENDPOINT = "/api/workbench/telemetry";

export type WorkbenchTelemetryPayload = {
  event: string;
  sessionId: string;
  timestamp: string;
  durationMs?: number;
  status?: string;
  approved?: boolean;
  // Allow additional low-cardinality fields (server ignores unknown keys).
  [k: string]: unknown;
};

export function getOrCreateWorkbenchSessionId(): string {
  const existing = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (existing && existing.trim().length > 0) return existing;
  const next = uuidv4();
  window.sessionStorage.setItem(SESSION_STORAGE_KEY, next);
  return next;
}

export async function emitWorkbenchEvent(
  input: Omit<WorkbenchTelemetryPayload, "sessionId" | "timestamp"> & {
    sessionId?: string;
    timestamp?: string;
  },
  options?: { endpoint?: string }
): Promise<void> {
  if (typeof window === "undefined") return;

  const payload: WorkbenchTelemetryPayload = {
    ...input,
    event: input.event,
    sessionId: input.sessionId ?? getOrCreateWorkbenchSessionId(),
    timestamp: input.timestamp ?? new Date().toISOString(),
  };

  // Best-effort: ignore failures to avoid breaking UX.
  try {
    await fetch(options?.endpoint ?? DEFAULT_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "include",
      keepalive: true,
    });
  } catch {
    // noop
  }
}

