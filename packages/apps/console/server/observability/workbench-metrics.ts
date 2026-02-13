/**
 * packages/apps/console/server/observability/workbench-metrics.ts
 *
 * Workbench UX Prometheus metrics (Phase 4.5).
 *
 * Purpose: Convert Workbench analytics taxonomy events into low-cardinality
 * Prometheus series suitable for Grafana dashboards and SLO alerting.
 */
import { Counter, Gauge, Histogram, Registry } from "prom-client";

type WorkbenchEnvironment = "production" | "staging" | "development";

export type WorkbenchTelemetryEventInput = {
  event: string;
  durationMs?: number;
  status?: string;
  approved?: boolean;
};

function readEnvironmentLabel(): WorkbenchEnvironment {
  const explicit = String(process.env.WORKBENCH_ENVIRONMENT ?? "").trim();
  if (explicit === "production" || explicit === "staging" || explicit === "development") return explicit;
  const nodeEnv = String(process.env.NODE_ENV ?? "").trim();
  if (nodeEnv === "production") return "production";
  return "development";
}

const registry = new Registry();

const eventsTotal = new Counter({
  name: "golden_contract_workbench_events_total",
  help: "Count of Workbench analytics taxonomy events received by the Console server.",
  labelNames: ["event", "environment"] as const,
  registers: [registry],
});

const sessionsActive = new Gauge({
  name: "golden_contract_workbench_sessions_active",
  help: "Gauge of active Workbench sessions (best-effort; derived from start/end events).",
  labelNames: ["environment"] as const,
  registers: [registry],
});

const runsTotal = new Counter({
  name: "golden_contract_workbench_runs_total",
  help: "Count of workflow runs started/completed from Workbench.",
  labelNames: ["status", "environment"] as const,
  registers: [registry],
});

const approvalsTotal = new Counter({
  name: "golden_contract_workbench_approvals_total",
  help: "Count of approval decisions taken in Workbench.",
  labelNames: ["approved", "environment"] as const,
  registers: [registry],
});

const eventDurationSeconds = new Histogram({
  name: "golden_contract_workbench_event_duration_seconds",
  help: "Client-reported durations for selected Workbench events (seconds).",
  labelNames: ["event", "environment"] as const,
  // Buckets cover UI/UX timings (500ms → 30m).
  buckets: [0.25, 0.5, 1, 2, 5, 10, 30, 60, 120, 300, 600, 900, 1800],
  registers: [registry],
});

export function recordWorkbenchTelemetry(input: WorkbenchTelemetryEventInput): void {
  const environment = readEnvironmentLabel();
  const event = input.event;

  eventsTotal.inc({ event, environment }, 1);

  if (event === "workbench.session_started") {
    sessionsActive.inc({ environment }, 1);
  }
  if (event === "workbench.session_ended") {
    sessionsActive.dec({ environment }, 1);
  }

  if (event === "workbench.workflow_run_started") {
    runsTotal.inc({ status: "started", environment }, 1);
  }
  if (event === "workbench.workflow_run_completed") {
    const status = typeof input.status === "string" && input.status.length > 0 ? input.status : "unknown";
    runsTotal.inc({ status, environment }, 1);
  }

  if (event === "workbench.approval_completed") {
    approvalsTotal.inc({ approved: input.approved ? "true" : "false", environment }, 1);
  }

  if (typeof input.durationMs === "number" && Number.isFinite(input.durationMs) && input.durationMs >= 0) {
    eventDurationSeconds.observe({ event, environment }, input.durationMs / 1000);
  }
}

export async function getWorkbenchMetricsText(): Promise<{ contentType: string; body: string }> {
  return {
    contentType: registry.contentType,
    body: await registry.metrics(),
  };
}

export function resetWorkbenchMetricsForTests(): void {
  registry.resetMetrics();
}

