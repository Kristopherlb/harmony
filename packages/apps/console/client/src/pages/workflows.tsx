/**
 * packages/apps/console/client/src/pages/workflows.tsx
 * Workflow browsing UI wired to /api/workflows (Temporal).
 */
import React from "react";
import { Link } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { apiRequest } from "@/lib/queryClient";

type WorkflowListItem = {
  workflowId: string;
  runId?: string;
  type?: string;
  status?: string;
  startTime?: string;
  closeTime?: string | null;
};

type WorkflowDescribe = {
  workflowId: string;
  runId: string;
  status: string;
  type: string;
  startTime?: string;
  closeTime?: string;
  historyLength?: number;
};

type WorkflowProgress = {
  workflowId: string;
  runId: string;
  status: string;
  steps: Array<{ seq: number; activityId: string; capId: string; status: string }>;
};

type WorkflowResult =
  | { workflowId: string; runId: string; result: unknown }
  | { workflowId: string; runId: string; status: string; error: string }
  | { error: string; status?: string };

function statusVariant(status: string | undefined): "default" | "secondary" | "destructive" | "outline" {
  const s = (status ?? "").toUpperCase();
  if (s === "FAILED" || s === "TERMINATED") return "destructive";
  if (s === "COMPLETED") return "secondary";
  if (s === "RUNNING") return "default";
  return "outline";
}

export function WorkflowListPage(): JSX.Element {
  const workflowsQuery = useQuery<WorkflowListItem[]>({
    queryKey: ["/api/workflows"],
    refetchInterval: 5000,
  });

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Workflows</h1>
        <p className="text-sm text-muted-foreground">
          Browse recent workflow executions from Temporal.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-base">Recent workflows</CardTitle>
              <CardDescription>Up to 50 results. Auto-refreshing.</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => workflowsQuery.refetch()}
              disabled={workflowsQuery.isFetching}
            >
              {workflowsQuery.isFetching ? "Refreshing…" : "Refresh"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {workflowsQuery.isLoading ? (
            <div className="p-4 text-sm text-muted-foreground">Loading…</div>
          ) : workflowsQuery.data?.length ? (
            <div className="divide-y">
              {workflowsQuery.data.map((wf) => (
                <Link key={wf.workflowId} href={`/workflows/${encodeURIComponent(wf.workflowId)}`}>
                  <a className="block p-4 hover:bg-accent/40 transition-colors" data-testid={`workflow-row-${wf.workflowId}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <div className="font-mono text-sm truncate">{wf.workflowId}</div>
                        <div className="text-xs text-muted-foreground font-mono truncate">
                          {wf.type ?? "unknown.type"} {wf.runId ? `· runId:${wf.runId}` : ""}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={statusVariant(wf.status)} className="font-mono text-[10px]">
                          {wf.status ?? "UNKNOWN"}
                        </Badge>
                      </div>
                    </div>
                  </a>
                </Link>
              ))}
            </div>
          ) : (
            <div className="p-4 text-sm text-muted-foreground">No workflows found.</div>
          )}
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground">
        <span className="font-medium">Tip:</span> Use Workbench to run Blueprints, then come here to inspect execution status.
      </div>
    </div>
  );
}

export function WorkflowDetailPage(props: { params: { id: string } }): JSX.Element {
  const id = props.params.id;

  const describeQuery = useQuery<WorkflowDescribe>({
    queryKey: [`/api/workflows/${encodeURIComponent(id)}`],
    refetchInterval: 2000,
  });

  const progressQuery = useQuery<WorkflowProgress>({
    queryKey: [`/api/workflows/${encodeURIComponent(id)}/progress`],
    refetchInterval: 2000,
  });

  const resultQuery = useQuery<WorkflowResult>({
    queryKey: [`/api/workflows/${encodeURIComponent(id)}/result`],
    // Result endpoint returns 409 when not completed; avoid hammering it.
    enabled: false,
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/workflows/${encodeURIComponent(id)}/cancel`, {});
      return res.json() as Promise<{ ok: boolean; workflowId: string }>;
    },
  });

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Workflow</h1>
        <p className="text-sm text-muted-foreground">
          Detail view for <code className="font-mono">{props.params.id}</code>.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Link href="/workflows" className="underline text-sm">
          Back to workflows
        </Link>
        <Separator orientation="vertical" className="h-4" />
        <Button
          variant="outline"
          size="sm"
          data-testid="button-cancel-workflow"
          onClick={() => cancelMutation.mutate()}
          disabled={cancelMutation.isPending}
        >
          {cancelMutation.isPending ? "Cancelling…" : "Cancel"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            describeQuery.refetch().catch(() => {});
            progressQuery.refetch().catch(() => {});
          }}
        >
          Refresh
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => resultQuery.refetch().catch(() => {})}
        >
          Fetch result
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status</CardTitle>
          <CardDescription>Live describe + derived step progress.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {describeQuery.isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : describeQuery.data ? (
            <div className="grid gap-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="text-muted-foreground font-mono text-xs">workflowId</div>
                <div className="font-mono">{describeQuery.data.workflowId}</div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="text-muted-foreground font-mono text-xs">runId</div>
                <div className="font-mono">{describeQuery.data.runId}</div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="text-muted-foreground font-mono text-xs">type</div>
                <div className="font-mono">{describeQuery.data.type}</div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="text-muted-foreground font-mono text-xs">status</div>
                <Badge variant={statusVariant(describeQuery.data.status)} className="font-mono text-[10px]">
                  {describeQuery.data.status}
                </Badge>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No data.</div>
          )}

          <Separator />

          <div className="space-y-2">
            <div className="text-sm font-medium">Progress</div>
            {progressQuery.isLoading ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : progressQuery.data ? (
              progressQuery.data.steps.length ? (
                <ul className="text-sm space-y-2">
                  {progressQuery.data.steps.map((s) => (
                    <li key={s.seq} className="rounded-md border p-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-mono text-xs truncate">
                          {s.capId} · {s.activityId}
                        </div>
                        <Badge variant={statusVariant(s.status)} className="font-mono text-[10px]">
                          {s.status}
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-sm text-muted-foreground">No step progress available.</div>
              )
            ) : (
              <div className="text-sm text-muted-foreground">No progress data.</div>
            )}
          </div>

          {resultQuery.data ? (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="text-sm font-medium">Result</div>
                <pre className="rounded-md border bg-muted p-3 overflow-auto max-h-[320px] text-[11px]">
                  {JSON.stringify(resultQuery.data, null, 2)}
                </pre>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

