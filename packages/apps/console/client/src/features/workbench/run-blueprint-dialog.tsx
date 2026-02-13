import React from "react";
import { Play, ExternalLink, Loader2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useMcpToolCatalog } from "@/features/workbench/use-mcp-tools";
import { ExecutionTimeline } from "@/features/workbench/execution-timeline";
import { Link } from "wouter";
import { emitWorkbenchEvent } from "@/lib/workbench-telemetry";

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

export interface RunBlueprintDialogProps {
  /** Called when a run starts (Phase 4.3.2 live canvas) */
  onRunStarted?: (workflowId: string) => void;
  /** Called when run reaches terminal status */
  onRunEnded?: (workflowId: string) => void;
}

export function RunBlueprintDialog({ onRunStarted, onRunEnded }: RunBlueprintDialogProps = {}) {
  const { tools, loading: toolsLoading } = useMcpToolCatalog();
  const blueprintTools = React.useMemo(
    () => tools.filter((t) => t.type === "BLUEPRINT"),
    [tools]
  );

  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<string | undefined>(undefined);
  const [inputText, setInputText] = React.useState<string>("{}");
  const [run, setRun] = React.useState<RunResponse | null>(null);
  const [status, setStatus] = React.useState<DescribeResponse | null>(null);
  const [result, setResult] = React.useState<unknown>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [running, setRunning] = React.useState(false);
  const runStartedAtRef = React.useRef<number | null>(null);

  const selectedTool = React.useMemo(
    () => blueprintTools.find((t) => t.name === selected) ?? null,
    [blueprintTools, selected]
  );

  React.useEffect(() => {
    if (!selected && blueprintTools.length > 0) {
      setSelected(blueprintTools[0].name);
    }
  }, [selected, blueprintTools]);

  // Reset execution state when switching tool or reopening.
  React.useEffect(() => {
    if (!open) {
      setRun(null);
      setStatus(null);
      setResult(null);
      setError(null);
      setRunning(false);
    }
  }, [open]);

  React.useEffect(() => {
    if (!run?.workflowId) return;
    let cancelled = false;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/workflows/${encodeURIComponent(run.workflowId)}`);
        if (!res.ok) return;
        const json = (await res.json()) as DescribeResponse;
        if (cancelled) return;
        setStatus(json);

        if (TERMINAL_STATUSES.includes(json.status)) {
          onRunEnded?.(run.workflowId);
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
          clearInterval(interval);
        }
        if (json.status === "COMPLETED") {
          const rr = await fetch(
            `/api/workflows/${encodeURIComponent(run.workflowId)}/result`
          );
          if (rr.ok) {
            const rj = (await rr.json()) as { result: unknown };
            if (!cancelled) setResult(rj.result);
          }
        }
      } catch {
        // ignore polling errors
      }
    }, 1000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [run?.workflowId, onRunEnded]);

  async function startRun() {
    if (!selected) return;
    setError(null);
    setRunning(true);
    setRun(null);
    setStatus(null);
    setResult(null);
    runStartedAtRef.current = null;

    let input: unknown = {};
    try {
      input = inputText.trim().length ? JSON.parse(inputText) : {};
    } catch (e) {
      setRunning(false);
      setError(`Invalid JSON input: ${(e as Error).message}`);
      return;
    }

    try {
      const res = await fetch("/api/workflows/run-blueprint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blueprintId: selected, input }),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text || res.statusText);
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
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 text-green-600"
        title="Run workflow"
        onClick={() => setOpen(true)}
        data-testid="workbench-run-open"
      >
        <Play className="w-4 h-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Run workflow (local Temporal)</DialogTitle>
            <DialogDescription>
              Select a registered Blueprint and execute it on your local Temporal server
              (taskQueue <span className="font-mono">golden-tools</span>).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-2">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Blueprint
              </div>
              <Select
                value={selected}
                onValueChange={(v) => {
                  setSelected(v);
                  setRun(null);
                  setStatus(null);
                  setResult(null);
                  setError(null);
                }}
                disabled={toolsLoading || blueprintTools.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a blueprint…" />
                </SelectTrigger>
                <SelectContent>
                  {blueprintTools.map((t) => (
                    <SelectItem key={t.name} value={t.name}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedTool ? (
                <div className="text-xs text-muted-foreground">
                  {selectedTool.description}{" "}
                  <Badge variant="secondary" className="ml-2 text-[10px] font-mono">
                    {selectedTool.dataClassification}
                  </Badge>
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Input (JSON)
              </div>
              <Textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="font-mono text-xs min-h-[160px]"
                placeholder='{"x": 1}'
              />
              {selectedTool?.inputSchema ? (
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground">
                    Show input schema
                  </summary>
                  <pre className="mt-2 rounded-md border bg-muted p-3 overflow-auto max-h-[240px] text-[11px]">
                    {JSON.stringify(selectedTool.inputSchema, null, 2)}
                  </pre>
                </details>
              ) : null}
            </div>

            {error ? (
              <div className="text-sm text-destructive whitespace-pre-wrap">{error}</div>
            ) : null}

            {run ? (
              <div className="rounded-md border p-3 space-y-2">
                <ExecutionTimeline workflowId={run.workflowId} compact={false} />
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
                  <div>runId: <span className="font-mono">{run.runId}</span></div>
                  <div>type: <span className="font-mono">{run.workflowType}</span></div>
                  <div>taskQueue: <span className="font-mono">{run.taskQueue}</span></div>
                  <div>
                    status:{" "}
                    <span className="font-mono">{status?.status ?? "…"}</span>
                  </div>
                </div>
                {result !== null ? (
                  <pre className="mt-2 rounded-md border bg-muted p-3 overflow-auto max-h-[240px] text-[11px]">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                ) : null}
                {status?.status === "RUNNING" ? (
                  <div className="text-xs text-muted-foreground">
                    If this stays RUNNING, make sure the local worker is running for taskQueue{" "}
                    <span className="font-mono">golden-tools</span>.
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button
              onClick={startRun}
              disabled={!selected || running}
              data-testid="workbench-run-submit"
            >
              {running ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Run
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

