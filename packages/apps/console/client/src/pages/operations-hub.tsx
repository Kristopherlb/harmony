import { useState, type ComponentType } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { NOCHeader } from "@/components/noc-header";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { OperationsHubView } from "@/features/operations-hub/view/OperationsHubView";
import { useToast } from "@/hooks/use-toast";
import {
  Server, RefreshCw, Database, Rocket, TrendingUp, Trash2,
  Play, AlertTriangle, Loader2
} from "lucide-react";
import type {
  Action,
  ActionCatalogResponse,
  WorkflowExecution,
  QueryTemplate,
  QueryExecutionResult,
} from "@shared/schema";

const ICON_MAP: Record<string, ComponentType<{ className?: string }>> = {
  server: Server,
  "refresh-cw": RefreshCw,
  database: Database,
  rocket: Rocket,
  "trending-up": TrendingUp,
  "trash-2": Trash2,
};

export default function OperationsHub() {
  const { toast } = useToast();
  const [selectedAction, setSelectedAction] = useState<Action | null>(null);
  const [actionParams, setActionParams] = useState<Record<string, any>>({});
  const [reasoning, setReasoning] = useState("");
  const [workflowOutput, setWorkflowOutput] = useState<string[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<QueryTemplate | null>(null);
  const [queryParams, setQueryParams] = useState<Record<string, any>>({});
  const [queryResult, setQueryResult] = useState<QueryExecutionResult | null>(null);

  const catalogQuery = useQuery<ActionCatalogResponse>({
    queryKey: ["/api/actions/catalog"],
  });

  const executionsQuery = useQuery<{ executions: WorkflowExecution[] }>({
    queryKey: ["/api/actions/executions"],
    refetchInterval: 5000,
  });

  const pendingQuery = useQuery<{ executions: WorkflowExecution[] }>({
    queryKey: ["/api/actions/approvals/pending"],
    refetchInterval: 5000,
  });

  const workbenchPendingQuery = useQuery<{ workflows: any[] }>({
    queryKey: ["/api/workflows/pending-approvals?type=workbenchDraftRunWorkflow"],
    refetchInterval: 5000,
  });

  const templatesQuery = useQuery<{ templates: QueryTemplate[] }>({
    queryKey: ["/api/sql/templates"],
  });

  const executeMutation = useMutation({
    mutationFn: async (payload: { actionId: string; params: Record<string, any>; reasoning: string }) => {
      const res = await apiRequest("POST", "/api/actions/execute", payload);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        predicate: (q) =>
          typeof q.queryKey[0] === "string" &&
          String(q.queryKey[0]).startsWith("/api/actions/executions"),
      });
      queryClient.invalidateQueries({
        predicate: (q) =>
          typeof q.queryKey[0] === "string" &&
          String(q.queryKey[0]).startsWith("/api/actions/approvals/pending"),
      });

      if (data.requiresApproval) {
        toast({
          title: "Approval Required",
          description: `Action "${selectedAction?.name}" requires approval before execution.`,
        });
      } else {
        toast({
          title: "Action Started",
          description: `Executing "${selectedAction?.name}"...`,
        });
        pollWorkflowStatus(data.execution.runId);
      }

      setSelectedAction(null);
      setActionParams({});
      setReasoning("");
    },
    onError: (error) => {
      toast({
        title: "Execution Failed",
        description: error instanceof Error ? error.message : "Failed to execute action",
        variant: "destructive",
      });
    },
  });

  const approvalMutation = useMutation({
    mutationFn: async (payload: { executionId: string; action: "approve" | "reject"; comment?: string }) => {
      const res = await apiRequest("POST", "/api/actions/approvals", payload);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        predicate: (q) =>
          typeof q.queryKey[0] === "string" &&
          String(q.queryKey[0]).startsWith("/api/actions/executions"),
      });
      queryClient.invalidateQueries({
        predicate: (q) =>
          typeof q.queryKey[0] === "string" &&
          String(q.queryKey[0]).startsWith("/api/actions/approvals/pending"),
      });
      toast({
        title: data.action === "approve" ? "Approved" : "Rejected",
        description: `Action has been ${data.action}d.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to process approval",
        variant: "destructive",
      });
    },
  });

  const workbenchApprovalMutation = useMutation({
    mutationFn: async (payload: { workflowId: string; decision: "approved" | "rejected" }) => {
      const res = await apiRequest("POST", `/api/workflows/${encodeURIComponent(payload.workflowId)}/approval`, {
        decision: payload.decision,
        approverId: "ops-hub-user",
        approverRoles: ["ops-hub"],
        reason: payload.decision === "rejected" ? "Rejected via Operations Hub" : undefined,
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        predicate: (q) =>
          typeof q.queryKey[0] === "string" &&
          String(q.queryKey[0]).startsWith("/api/workflows/pending-approvals"),
      });
      toast({
        title: data.decision === "approved" ? "Approved" : "Rejected",
        description: `Workflow run has been ${data.decision}.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to process approval",
        variant: "destructive",
      });
    },
  });

  const queryMutation = useMutation({
    mutationFn: async (payload: { templateId: string; params: Record<string, any> }) => {
      const res = await apiRequest("POST", "/api/sql/execute", payload);
      return res.json();
    },
    onSuccess: (data) => {
      setQueryResult(data);
      toast({
        title: "Query Executed",
        description: `Found ${data.rowCount} rows in ${data.executionTimeMs}ms`,
      });
    },
    onError: (error) => {
      toast({
        title: "Query Failed",
        description: error instanceof Error ? error.message : "Failed to execute query",
        variant: "destructive",
      });
    },
  });

  const pollWorkflowStatus = async (runId: string) => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/actions/executions/${runId}/status`);
        const data = await res.json();
        setWorkflowOutput(data.output || []);

        if (data.status === "running") {
          setTimeout(poll, 1000);
        } else if (data.status === "completed") {
          toast({ title: "Completed", description: "Workflow finished successfully" });
        } else if (data.status === "failed") {
          toast({ title: "Failed", description: data.error || "Workflow failed", variant: "destructive" });
        }
      } catch (e) {
        console.error("Poll error:", e);
      }
    };
    poll();
  };

  const actions = catalogQuery.data?.actions ?? [];
  const categories = catalogQuery.data?.categories ?? [];
  const executions = executionsQuery.data?.executions ?? [];
  const pendingApprovals = pendingQuery.data?.executions ?? [];
  const workbenchPendingApprovals = workbenchPendingQuery.data?.workflows ?? [];
  const templates = templatesQuery.data?.templates ?? [];

  if (catalogQuery.isLoading) { // Assuming eventsQuery is not defined, using catalogQuery for loading
    return (
      <div data-testid="ops-console-loading">
        <div className="flex h-[calc(100vh-140px)]">
          <div className="w-full md:w-1/4 border-r border-border p-3 space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
          <div className="hidden md:block w-1/2 p-4">
            <Skeleton className="h-32 w-full mb-4" />
            <Skeleton className="h-64 w-full" />
          </div>
          <div className="hidden md:block w-1/4 border-l border-border p-3 space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6" data-testid="ops-console-page">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">
            Operations Hub
          </h1>
          {pendingApprovals.length > 0 && (
            <Badge variant="destructive" className="gap-1" data-testid="badge-pending-count">
              <AlertTriangle className="h-3 w-3" />
              {pendingApprovals.length} Pending Approval{pendingApprovals.length !== 1 && "s"}
            </Badge>
          )}
        </div>

        {workbenchPendingApprovals.length > 0 ? (
          <div className="mb-6 rounded-lg border bg-card p-4" data-testid="card-workbench-pending-approvals">
            <div className="flex items-center justify-between gap-2">
              <div className="font-semibold">Workbench pending approvals</div>
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                {workbenchPendingApprovals.length}
              </Badge>
            </div>
            <div className="mt-3 space-y-3">
              {workbenchPendingApprovals.slice(0, 25).map((w: any) => (
                <div key={w.workflowId} className="rounded-md border p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{w.workflowId}</div>
                      <div className="text-xs text-muted-foreground font-mono truncate">
                        type:{w.type} status:{w.status}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => workbenchApprovalMutation.mutate({ workflowId: w.workflowId, decision: "approved" })}
                        disabled={workbenchApprovalMutation.isPending}
                        data-testid={`button-approve-workbench-${w.workflowId}`}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => workbenchApprovalMutation.mutate({ workflowId: w.workflowId, decision: "rejected" })}
                        disabled={workbenchApprovalMutation.isPending}
                        data-testid={`button-reject-workbench-${w.workflowId}`}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                  {w.state?.requestReason ? (
                    <div className="text-xs text-muted-foreground whitespace-pre-wrap">{w.state.requestReason}</div>
                  ) : null}
                  {Array.isArray(w.state?.requiredRoles) && w.state.requiredRoles.length > 0 ? (
                    <div className="text-xs text-muted-foreground">
                      requiredRoles: <span className="font-mono">{w.state.requiredRoles.join(", ")}</span>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <OperationsHubView
          categories={categories}
          actions={actions}
          pendingApprovals={pendingApprovals}
          executions={executions}
          templates={templates}
          selectedTemplate={selectedTemplate}
          queryResult={queryResult}
          isLoadingCatalog={catalogQuery.isLoading}
          isLoadingExecutions={executionsQuery.isLoading}
          isLoadingTemplates={templatesQuery.isLoading}
          isExecutingQuery={queryMutation.isPending}
          onActionRun={(action) => {
            setSelectedAction(action);
            setActionParams({});
            setReasoning("");
          }}
          onApprove={(executionId) => {
            approvalMutation.mutate({ executionId, action: "approve" });
          }}
          onReject={(executionId) => {
            approvalMutation.mutate({ executionId, action: "reject" });
          }}
          isApprovalPending={approvalMutation.isPending}
          onTemplateSelect={(template) => {
            setSelectedTemplate(template);
            setQueryParams({});
            setQueryResult(null);
          }}
          onQueryParamChange={setQueryParams}
          queryParams={queryParams}
          onExecuteQuery={() => {
            if (selectedTemplate) {
              queryMutation.mutate({
                templateId: selectedTemplate.id,
                params: queryParams,
              });
            }
          }}
        />

        {workflowOutput.length > 0 && (
          <div className="mt-6 p-4 bg-card border border-border rounded-lg" data-testid="card-workflow-output">
            <h3 className="text-lg font-semibold mb-4">Workflow Console</h3>
            <ScrollArea className="h-48 bg-black/50 rounded-lg p-4 font-mono text-xs text-status-healthy">
              {workflowOutput.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </ScrollArea>
          </div>
        )}
      </div>

      <Dialog open={!!selectedAction} onOpenChange={() => setSelectedAction(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedAction && (
                <>
                  {(() => {
                    const Icon = ICON_MAP[selectedAction.icon || "server"] || Server;
                    return <Icon className="h-5 w-5" />;
                  })()}
                  {selectedAction.name}
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedAction?.description}
              {selectedAction && ["critical", "high"].includes(selectedAction.riskLevel) && (
                <div className="mt-2 p-2 rounded bg-status-degraded/10 text-status-degraded text-xs">
                  This action requires approval before execution
                </div>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {selectedAction?.requiredParams.map((param) => (
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
                    <SelectTrigger id={`param-${param.name}`} data-testid={`select-${param.name}`}>
                      <SelectValue placeholder={param.placeholder || "Select..."} />
                    </SelectTrigger>
                    <SelectContent>
                      {param.options?.map((opt) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : param.type === "boolean" ? (
                  <div className="flex items-center gap-2">
                    <Switch
                      id={`param-${param.name}`}
                      checked={!!actionParams[param.name]}
                      onCheckedChange={(v) => setActionParams((p) => ({ ...p, [param.name]: v }))}
                      data-testid={`switch-${param.name}`}
                    />
                  </div>
                ) : (
                  <Input
                    id={`param-${param.name}`}
                    type={param.type === "number" ? "number" : param.type === "email" ? "email" : "text"}
                    placeholder={param.placeholder}
                    value={actionParams[param.name] || ""}
                    onChange={(e) => setActionParams((p) => ({ ...p, [param.name]: e.target.value }))}
                    data-testid={`input-${param.name}`}
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
                placeholder="Explain why you are executing this action (min 10 characters)"
                value={reasoning}
                onChange={(e) => setReasoning(e.target.value)}
                data-testid="textarea-reasoning"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedAction(null)} data-testid="button-cancel-action">
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedAction) {
                  executeMutation.mutate({
                    actionId: selectedAction.id,
                    params: actionParams,
                    reasoning,
                  });
                }
              }}
              disabled={executeMutation.isPending || reasoning.length < 10}
              data-testid="button-submit-action"
            >
              {executeMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Execute
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
