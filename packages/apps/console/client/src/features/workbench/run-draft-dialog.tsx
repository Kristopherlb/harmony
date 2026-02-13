import React from "react";
import { Play, ExternalLink, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import type { BlueprintDraft } from "@/features/workbench/types";
import { ExecutionTimeline } from "@/features/workbench/execution-timeline";
import { Link } from "wouter";
import { emitWorkbenchEvent } from "@/lib/workbench-telemetry";

type DraftPreflightFinding =
  | { kind: "unknown_tool"; nodeId: string; toolId: string }
  | { kind: "missing_required"; nodeId: string; toolId: string; field: string }
  | { kind: "restricted_requires_approval"; nodeId: string; toolId: string };

type DraftPreflightWarning = { kind: "critical_requires_peer_approval"; nodeId: string; toolId: string };

type DraftPreflightReport = { ok: boolean; findings: DraftPreflightFinding[]; warnings: DraftPreflightWarning[] };

type RunResponse = {
  workflowId: string;
  runId: string;
  taskQueue: string;
  workflowType: string;
};

type DescribeResponse = {
  workflowId: string;
  runId: string;
  status: string;
  type: string;
  startTime?: string;
  closeTime?: string;
  historyLength?: number;
};

const TERMINAL_STATUSES = ["COMPLETED", "FAILED", "CANCELED", "TERMINATED"];

export interface RunDraftDialogProps {
  draft: BlueprintDraft | null;
  onFixItSelectNode?: (nodeId: string) => void;
  onRunStarted?: (workflowId: string) => void;
}

export function RunDraftDialog({ draft, onFixItSelectNode, onRunStarted }: RunDraftDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [approvedRestricted, setApprovedRestricted] = React.useState(false);
  const [preflight, setPreflight] = React.useState<DraftPreflightReport | null>(null);
  const [preflightLoading, setPreflightLoading] = React.useState(false);
  const [preflightError, setPreflightError] = React.useState<string | null>(null);

  const [run, setRun] = React.useState<RunResponse | null>(null);
  const [runError, setRunError] = React.useState<string | null>(null);
  const [running, setRunning] = React.useState(false);
  const [approvalState, setApprovalState] = React.useState<any>(null);
  const [approvalError, setApprovalError] = React.useState<string | null>(null);
  const [approving, setApproving] = React.useState<"idle" | "approve" | "reject">("idle");
  const runStartedAtRef = React.useRef<number | null>(null);

  const findings = preflight?.findings ?? [];
  const warnings = preflight?.warnings ?? [];
  const hasBlockingFindings = preflight ? !preflight.ok : false;
  const restrictedFindings = findings.filter((f) => f.kind === "restricted_requires_approval") as Array<
    Extract<DraftPreflightFinding, { kind: "restricted_requires_approval" }>
  >;

  const missingFindings = findings.filter((f) => f.kind === "missing_required") as Array<
    Extract<DraftPreflightFinding, { kind: "missing_required" }>
  >;

  const unknownFindings = findings.filter((f) => f.kind === "unknown_tool") as Array<
    Extract<DraftPreflightFinding, { kind: "unknown_tool" }>
  >;

  const criticalWarnings = warnings.filter((w) => w.kind === "critical_requires_peer_approval") as Array<
    Extract<DraftPreflightWarning, { kind: "critical_requires_peer_approval" }>
  >;

  async function runPreflight() {
    if (!draft) return;
    setPreflightLoading(true);
    setPreflightError(null);
    setPreflight(null);
    try {
      const res = await fetch("/api/workbench/drafts/preflight", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ draft, approvedRestricted }),
      });
      const json = (await res.json()) as DraftPreflightReport | { error: string; details?: unknown };
      if (!res.ok) {
        throw new Error(typeof (json as any)?.error === "string" ? (json as any).error : "Preflight failed");
      }
      setPreflight(json as DraftPreflightReport);
    } catch (e) {
      setPreflightError((e as Error).message);
    } finally {
      setPreflightLoading(false);
    }
  }

  React.useEffect(() => {
    if (!open) return;
    if (!draft) return;
    void runPreflight();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, approvedRestricted, draft]);

  React.useEffect(() => {
    if (!open) {
      setApprovedRestricted(false);
      setPreflight(null);
      setPreflightError(null);
      setPreflightLoading(false);
      setRun(null);
      setRunError(null);
      setRunning(false);
      setApprovalState(null);
      setApprovalError(null);
      setApproving("idle");
      runStartedAtRef.current = null;
    }
  }, [open]);

  // Milestone 1 parity: emit run completion telemetry from draft-run path.
  React.useEffect(() => {
    if (!open) return;
    if (!run?.workflowId) return;

    let cancelled = false;
    const interval = window.setInterval(async () => {
      try {
        const res = await fetch(`/api/workflows/${encodeURIComponent(run.workflowId)}`, {
          credentials: "include",
        });
        if (!res.ok) return;
        const json = (await res.json()) as DescribeResponse;
        if (cancelled) return;
        if (!TERMINAL_STATUSES.includes(json.status)) return;

        const startedAt = runStartedAtRef.current;
        const durationMs = typeof startedAt === "number" ? Math.max(0, Date.now() - startedAt) : undefined;
        emitWorkbenchEvent({
          event: "workbench.workflow_run_completed",
          runId: run.runId,
          workflowId: run.workflowId,
          status:
            json.status === "COMPLETED"
              ? "completed"
              : json.status === "FAILED"
                ? "failed"
                : json.status === "CANCELED" || json.status === "CANCELLED"
                  ? "cancelled"
                  : "failed",
          durationMs,
        }).catch(() => {});
        window.clearInterval(interval);
      } catch {
        // ignore polling errors
      }
    }, 1000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [open, run?.workflowId, run?.runId]);

  // Phase 2: poll approval state for HITL workflows.
  React.useEffect(() => {
    if (!open) return;
    if (!run?.workflowId) return;

    let cancelled = false;
    async function tick() {
      try {
        const res = await fetch(`/api/workflows/${encodeURIComponent(run.workflowId)}/approval`, {
          credentials: "include",
        });
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(json?.details || json?.error || res.statusText);
        setApprovalState(json?.state ?? null);
        setApprovalError(null);
      } catch (e) {
        if (cancelled) return;
        setApprovalError((e as Error).message);
      }
    }

    void tick();
    const id = window.setInterval(tick, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [open, run?.workflowId]);

  async function sendApproval(decision: "approved" | "rejected") {
    if (!run?.workflowId) return;
    setApproving(decision === "approved" ? "approve" : "reject");
    setApprovalError(null);
    try {
      const res = await fetch(`/api/workflows/${encodeURIComponent(run.workflowId)}/approval`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          decision,
          approverId: "workbench-user",
          approverRoles: ["workbench"],
          reason: decision === "rejected" ? "Rejected via Workbench" : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.details || json?.error || res.statusText);
    } catch (e) {
      setApprovalError((e as Error).message);
    } finally {
      setApproving("idle");
    }
  }

  async function startRun() {
    if (!draft) return;
    setRunError(null);
    setRunning(true);
    setRun(null);
    runStartedAtRef.current = null;

    try {
      const res = await fetch("/api/workbench/drafts/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ draft, approvedRestricted }),
      });
      const text = await res.text();
      if (!res.ok) {
        try {
          const parsed = JSON.parse(text);
          if (parsed?.error === "PREFLIGHT_FAILED") {
            setPreflight(parsed.report ?? null);
            throw new Error("Preflight failed. Fix the findings and try again.");
          }
          throw new Error(parsed?.details || parsed?.error || res.statusText);
        } catch {
          throw new Error(text || res.statusText);
        }
      }
      const json = JSON.parse(text) as RunResponse;
      setRun(json);
      onRunStarted?.(json.workflowId);
      runStartedAtRef.current = Date.now();
      emitWorkbenchEvent({
        event: "workbench.workflow_run_started",
        runId: json.runId,
        draftId: "current",
      }).catch(() => {});
    } catch (e) {
      setRunError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  const canRun = Boolean(draft) && Boolean(preflight?.ok) && !running;

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 text-green-600"
        title="Run current draft"
        onClick={() => setOpen(true)}
        disabled={!draft}
        data-testid="workbench-run-draft-open"
      >
        <Play className="w-4 h-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl" data-testid="run-draft-dialog">
          <DialogHeader>
            <DialogTitle>Run current draft</DialogTitle>
            <DialogDescription>
              Preflight validates tool availability, required fields, and restricted gating before executing on your
              local Temporal server (taskQueue <span className="font-mono">golden-tools</span>).
            </DialogDescription>
          </DialogHeader>

          {!draft ? (
            <div className="text-sm text-muted-foreground">No draft to run.</div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-md border p-3 text-sm space-y-1">
                <div className="font-semibold">{draft.title}</div>
                {draft.summary ? <div className="text-muted-foreground">{draft.summary}</div> : null}
                <div className="text-xs text-muted-foreground font-mono">
                  nodes:{draft.nodes.length} edges:{draft.edges.length}
                </div>
              </div>

              <div className="rounded-md border p-3 text-sm space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold">Preflight</div>
                  {preflight ? (
                    <Badge variant={preflight.ok ? "secondary" : "destructive"} className="text-[10px] font-mono">
                      {preflight.ok ? "OK" : `${findings.length} findings`}
                    </Badge>
                  ) : null}
                </div>

                {preflightLoading ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Checking…
                  </div>
                ) : preflightError ? (
                  <div className="text-xs text-destructive">{preflightError}</div>
                ) : preflight ? (
                  <>
                    {hasBlockingFindings ? (
                      <div className="text-xs text-muted-foreground flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-status-degraded mt-0.5" />
                        <div>
                          Fix the findings below. Click an item to highlight the node and open configuration.
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">Draft is runnable.</div>
                    )}

                    {criticalWarnings.length > 0 ? (
                      <div className="rounded-md border p-3 text-sm space-y-2">
                        <div className="font-semibold">Peer approval required during execution</div>
                        <div className="text-xs text-muted-foreground">
                          This draft includes <span className="font-mono">CRITICAL</span> steps. The run will pause
                          and wait for approval before executing them.
                        </div>
                        <div className="text-xs font-mono text-muted-foreground">
                          {Array.from(new Set(criticalWarnings.map((w) => w.toolId))).sort().join(", ")}
                        </div>
                      </div>
                    ) : null}

                    {restrictedFindings.length > 0 ? (
                      <div className="rounded-md border p-3 text-sm space-y-2">
                        <div className="font-semibold">Restricted tools detected</div>
                        <div className="text-xs text-muted-foreground">
                          These steps reference tools marked <span className="font-mono">RESTRICTED</span>. Approve to
                          proceed.
                        </div>
                        <div className="text-xs font-mono text-muted-foreground">
                          {Array.from(new Set(restrictedFindings.map((f) => f.toolId))).sort().join(", ")}
                        </div>
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={approvedRestricted}
                            onCheckedChange={(v) => setApprovedRestricted(Boolean(v))}
                          />
                          I approve executing RESTRICTED tool steps.
                        </label>
                      </div>
                    ) : null}

                    {(unknownFindings.length || missingFindings.length) ? (
                      <ul className="space-y-1 text-xs">
                        {unknownFindings.map((f, idx) => (
                          <li key={`u-${idx}`}>
                            <button
                              type="button"
                              className="w-full text-left rounded px-2 py-1 hover:bg-accent/40"
                              onClick={() => onFixItSelectNode?.(f.nodeId)}
                            >
                              <span className="font-mono">Unknown tool</span>: {f.toolId}{" "}
                              <span className="text-muted-foreground">(node {f.nodeId})</span>
                            </button>
                          </li>
                        ))}
                        {missingFindings.map((f, idx) => (
                          <li key={`m-${idx}`}>
                            <button
                              type="button"
                              className="w-full text-left rounded px-2 py-1 hover:bg-accent/40"
                              onClick={() => onFixItSelectNode?.(f.nodeId)}
                            >
                              <span className="font-mono">Missing</span>: {f.toolId}.{f.field}{" "}
                              <span className="text-muted-foreground">(node {f.nodeId})</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </>
                ) : (
                  <div className="text-xs text-muted-foreground">Open to run preflight.</div>
                )}
              </div>

              {runError ? <div className="text-sm text-destructive whitespace-pre-wrap">{runError}</div> : null}

              {run ? (
                <div className="rounded-md border p-3 space-y-2">
                  <ExecutionTimeline workflowId={run.workflowId} compact={false} />
                  {approvalState?.status === "pending" ? (
                    <div className="rounded-md border border-status-degraded/40 bg-status-degraded/5 p-3 space-y-2">
                      <div className="font-semibold text-sm">Approval required</div>
                      <div className="text-xs text-muted-foreground whitespace-pre-wrap">
                        {approvalState?.requestReason ?? "This run is waiting for approval."}
                      </div>
                      {Array.isArray(approvalState?.requiredRoles) && approvalState.requiredRoles.length > 0 ? (
                        <div className="text-xs text-muted-foreground">
                          requiredRoles:{" "}
                          <span className="font-mono">{approvalState.requiredRoles.join(", ")}</span>
                        </div>
                      ) : null}
                      {approvalError ? <div className="text-xs text-destructive">{approvalError}</div> : null}
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => sendApproval("approved")}
                          disabled={approving !== "idle"}
                          data-testid="workbench-approve-run"
                        >
                          {approving === "approve" ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => sendApproval("rejected")}
                          disabled={approving !== "idle"}
                          data-testid="workbench-reject-run"
                        >
                          {approving === "reject" ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                          Reject
                        </Button>
                      </div>
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-mono text-xs truncate" title={run.workflowId}>
                      {run.workflowId}
                    </div>
                    <Link href={`/workflows/${encodeURIComponent(run.workflowId)}`}>
                      <Button variant="outline" size="sm" className="gap-2">
                        View
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Button>
                    </Link>
                  </div>
                  <div className="text-xs text-muted-foreground grid grid-cols-2 gap-2">
                    <div>
                      runId: <span className="font-mono">{run.runId}</span>
                    </div>
                    <div>
                      type: <span className="font-mono">{run.workflowType}</span>
                    </div>
                    <div>
                      taskQueue: <span className="font-mono">{run.taskQueue}</span>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button onClick={startRun} disabled={!canRun} data-testid="workbench-run-draft-submit">
              {running ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Run
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

