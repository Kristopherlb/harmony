/**
 * packages/apps/console/client/src/pages/runbooks.tsx
 * Runbook execution UI (Phase 5).
 */
import * as React from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { BookOpen, Play, FileText, ExternalLink } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/patterns/EmptyState";
import { MarkdownProse } from "@/components/markdown/Markdown";
import type { Action, ActionCatalogResponse, RunbookDetail, RunbookListResponse, RunbookSummary } from "@shared/schema";

function runbookActionFor(runbook: RunbookSummary, actions: Action[]): Action | null {
  return actions.find((a) => a.id === runbook.id) ?? null;
}

export default function RunbooksPage(): JSX.Element {
  const [selectedRunbookId, setSelectedRunbookId] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("q") ?? "";
  });

  const [executeOpen, setExecuteOpen] = React.useState(false);
  const [actionParams, setActionParams] = React.useState<Record<string, any>>({});
  const [reasoning, setReasoning] = React.useState("");

  const runbooksQuery = useQuery<RunbookListResponse>({
    queryKey: ["/api/runbooks"],
  });

  const catalogQuery = useQuery<ActionCatalogResponse>({
    queryKey: ["/api/actions/catalog"],
  });

  const selectedRunbook = React.useMemo(() => {
    const list = runbooksQuery.data?.runbooks ?? [];
    return list.find((r) => r.id === selectedRunbookId) ?? null;
  }, [runbooksQuery.data?.runbooks, selectedRunbookId]);

  const runbookDetailQuery = useQuery<RunbookDetail>({
    queryKey: selectedRunbookId ? [`/api/runbooks/${selectedRunbookId}`] : ["__runbook_detail_disabled__"],
    enabled: !!selectedRunbookId,
  });

  const actions = catalogQuery.data?.actions ?? [];

  const filteredRunbooks = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = runbooksQuery.data?.runbooks ?? [];
    if (!q) return list;
    return list.filter((r) => `${r.id} ${r.title}`.toLowerCase().includes(q));
  }, [runbooksQuery.data?.runbooks, query]);

  const executeMutation = useMutation({
    mutationFn: async (payload: { actionId: string; params: Record<string, any>; reasoning: string }) => {
      const res = await apiRequest("POST", "/api/actions/execute", payload);
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        predicate: (q) =>
          typeof q.queryKey[0] === "string" &&
          String(q.queryKey[0]).startsWith("/api/actions/executions"),
      });
      await queryClient.invalidateQueries({
        predicate: (q) =>
          typeof q.queryKey[0] === "string" &&
          String(q.queryKey[0]).startsWith("/api/actions/approvals/pending"),
      });
      setExecuteOpen(false);
      setActionParams({});
      setReasoning("");
    },
  });

  const selectedAction = selectedRunbook ? runbookActionFor(selectedRunbook, actions) : null;

  return (
    <div data-testid="runbooks-page" className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-semibold">Runbooks</h1>
          </div>
          <div className="text-sm text-muted-foreground">
            Browse repo-local operational runbooks and launch the corresponding action workflows when available.
          </div>
        </div>
        <Badge variant="secondary" className="font-mono text-[10px]">
          count:{runbooksQuery.data?.runbooks?.length ?? 0}
        </Badge>
      </div>

      <div className="flex items-center gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search runbooks…"
          data-testid="input-runbook-search"
        />
        <Button type="button" variant="outline" onClick={() => runbooksQuery.refetch()} disabled={runbooksQuery.isFetching}>
          {runbooksQuery.isFetching ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Catalog</CardTitle>
            <CardDescription>Select a runbook to view content.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {runbooksQuery.isLoading ? (
              <div className="p-4 space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : filteredRunbooks.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={FileText}
                  title="No runbooks found"
                  description="Add markdown files under /runbooks to populate this catalog."
                />
              </div>
            ) : (
              <ScrollArea className="h-[560px]">
                <div className="divide-y">
                  {filteredRunbooks.map((r) => {
                    const active = r.id === selectedRunbookId;
                    const action = runbookActionFor(r, actions);
                    return (
                      <button
                        key={r.id}
                        type="button"
                        className={`w-full text-left p-4 hover:bg-accent/40 transition-colors ${active ? "bg-accent/40" : ""}`}
                        onClick={() => setSelectedRunbookId(r.id)}
                        data-testid={`runbook-row-${r.id}`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="text-sm font-medium">{r.title}</div>
                            {action ? (
                              <Badge variant="secondary" className="text-[10px] font-mono">
                                executable
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] font-mono">
                                read-only
                              </Badge>
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono">{r.filename}</div>
                          {r.updatedAt ? (
                            <div className="text-[10px] text-muted-foreground font-mono">
                              updated:{new Date(r.updatedAt).toLocaleString()}
                            </div>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <CardTitle className="text-sm font-semibold truncate">
                  {selectedRunbook ? selectedRunbook.title : "Select a runbook"}
                </CardTitle>
                <CardDescription className="truncate">
                  {selectedRunbook ? <span className="font-mono">{selectedRunbook.id}</span> : "Pick a runbook from the catalog."}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {selectedRunbookId ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    onClick={() => runbookDetailQuery.refetch()}
                    disabled={runbookDetailQuery.isFetching}
                  >
                    <ExternalLink className="h-4 w-4" />
                    Reload
                  </Button>
                ) : null}
                <Button
                  type="button"
                  className="gap-2"
                  disabled={!selectedRunbook || !selectedAction}
                  onClick={() => {
                    if (!selectedRunbook || !selectedAction) return;
                    setExecuteOpen(true);
                    setActionParams({});
                    setReasoning(`Runbook: ${selectedRunbook.title}`);
                  }}
                  data-testid="button-execute-runbook"
                >
                  <Play className="h-4 w-4" />
                  Execute
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {!selectedRunbook ? (
              <EmptyState icon={BookOpen} title="Select a runbook" description="Choose a runbook to view steps and execute the linked action." />
            ) : runbookDetailQuery.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-6 w-2/3" />
                <Skeleton className="h-48 w-full" />
              </div>
            ) : runbookDetailQuery.isError ? (
              <div className="text-sm text-destructive">
                Failed to load runbook content.
              </div>
            ) : (
              <div className="space-y-3">
                {selectedAction ? (
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="text-[10px] font-mono">
                      action:{selectedAction.id}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      risk:{selectedAction.riskLevel}
                    </Badge>
                    {(selectedAction.targetServices?.length ?? 0) > 0 ? (
                      <Badge variant="outline" className="text-[10px] font-mono">
                        targets:{selectedAction.targetServices.slice(0, 4).join(",")}
                      </Badge>
                    ) : null}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">
                    No executable action is registered for this runbook yet.
                  </div>
                )}

                <ScrollArea className="h-[470px]">
                  <div className="p-4 rounded-md bg-muted/40 border border-border">
                    <MarkdownProse content={runbookDetailQuery.data?.content ?? ""} />
                  </div>
                </ScrollArea>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={executeOpen} onOpenChange={setExecuteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedAction?.name ?? "Execute runbook"}</DialogTitle>
            <DialogDescription>{selectedAction?.description}</DialogDescription>
          </DialogHeader>

          {selectedAction ? (
            <div className="space-y-4 py-4">
              {selectedAction.requiredParams.map((param) => (
                <div key={param.name} className="space-y-1">
                  <Label htmlFor={`param-${param.name}`}>
                    {param.label}
                    {param.required && <span className="text-status-critical ml-1">*</span>}
                  </Label>
                  {param.type === "select" ? (
                    <Select
                      value={actionParams[param.name] || ""}
                      onValueChange={(v) => setActionParams((p) => ({ ...p, [param.name]: v }))}
                    >
                      <SelectTrigger id={`param-${param.name}`}>
                        <SelectValue placeholder={param.placeholder || "Select…"} />
                      </SelectTrigger>
                      <SelectContent>
                        {(param.options ?? []).map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : param.type === "boolean" ? (
                    <div className="flex items-center gap-2">
                      <Switch
                        id={`param-${param.name}`}
                        checked={!!actionParams[param.name]}
                        onCheckedChange={(v) => setActionParams((p) => ({ ...p, [param.name]: v }))}
                      />
                    </div>
                  ) : (
                    <Input
                      id={`param-${param.name}`}
                      type={param.type === "number" ? "number" : param.type === "email" ? "email" : "text"}
                      placeholder={param.placeholder}
                      value={actionParams[param.name] || ""}
                      onChange={(e) => setActionParams((p) => ({ ...p, [param.name]: e.target.value }))}
                    />
                  )}
                </div>
              ))}

              <div className="space-y-1">
                <Label htmlFor="reasoning">
                  Reasoning <span className="text-status-critical">*</span>
                </Label>
                <Textarea
                  id="reasoning"
                  placeholder="Why are you running this runbook?"
                  value={reasoning}
                  onChange={(e) => setReasoning(e.target.value)}
                />
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setExecuteOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!selectedAction) return;
                executeMutation.mutate({ actionId: selectedAction.id, params: actionParams, reasoning });
              }}
              disabled={!selectedAction || executeMutation.isPending || reasoning.trim().length < 10}
              className="gap-2"
              data-testid="button-confirm-execute-runbook"
            >
              <Play className="h-4 w-4" />
              Execute
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

