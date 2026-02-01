import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SectionHeader } from "@/components/patterns/SectionHeader";
import { EmptyState } from "@/components/patterns/EmptyState";
import { ActionCard } from "../components/ActionCard";
import { ApprovalCard } from "../components/ApprovalCard";
import { ExecutionRow } from "../components/ExecutionRow";
import { Server, FileText, Search, Play, Loader2 } from "lucide-react";
import type { Action, ActionCategory, WorkflowExecution, QueryTemplate, QueryExecutionResult } from "@shared/schema";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  server: Server,
  "refresh-cw": Server,
  database: Server,
  rocket: Server,
  "trending-up": Server,
  "trash-2": Server,
};

export interface OperationsHubViewProps {
  categories: ActionCategory[];
  actions: Action[];
  pendingApprovals: WorkflowExecution[];
  executions: WorkflowExecution[];
  templates: QueryTemplate[];
  selectedTemplate: QueryTemplate | null;
  queryResult: QueryExecutionResult | null;
  isLoadingCatalog: boolean;
  isLoadingExecutions: boolean;
  isLoadingTemplates: boolean;
  isExecutingQuery: boolean;
  onActionRun: (action: Action) => void;
  onApprove: (executionId: string) => void;
  onReject: (executionId: string) => void;
  isApprovalPending: boolean;
  onTemplateSelect: (template: QueryTemplate) => void;
  onQueryParamChange: (params: Record<string, any>) => void;
  queryParams: Record<string, any>;
  onExecuteQuery: () => void;
}

export function OperationsHubView({
  categories,
  actions,
  pendingApprovals,
  executions,
  templates,
  selectedTemplate,
  queryResult,
  isLoadingCatalog,
  isLoadingExecutions,
  isLoadingTemplates,
  isExecutingQuery,
  onActionRun,
  onApprove,
  onReject,
  isApprovalPending,
  onTemplateSelect,
  onQueryParamChange,
  queryParams,
  onExecuteQuery,
}: OperationsHubViewProps) {
  return (
    <Tabs defaultValue="catalog" className="space-y-6">
      <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
        <TabsTrigger value="catalog">Service Catalog</TabsTrigger>
        <TabsTrigger value="approvals">
          Approvals {pendingApprovals.length > 0 && `(${pendingApprovals.length})`}
        </TabsTrigger>
        <TabsTrigger value="executions">Executions</TabsTrigger>
        <TabsTrigger value="sql">SQL Runner</TabsTrigger>
      </TabsList>

      <TabsContent value="catalog" className="space-y-6">
        {isLoadingCatalog ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="h-32 animate-pulse bg-muted rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <>
            {categories.map((category) => (
              <section key={category.id} data-testid={`section-category-${category.id}`}>
                <SectionHeader title={category.name} count={category.count} />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {actions
                    .filter((a) => a.category === category.id)
                    .map((action) => {
                      const Icon = ICON_MAP[action.icon || "server"] || Server;
                      return (
                        <ActionCard
                          key={action.id}
                          action={action}
                          icon={Icon}
                          onRun={() => onActionRun(action)}
                        />
                      );
                    })}
                </div>
              </section>
            ))}
          </>
        )}
      </TabsContent>

      <TabsContent value="approvals">
        <Card>
          <CardHeader>
            <CardTitle>Pending Approvals</CardTitle>
            <CardDescription>Critical and high-risk actions awaiting approval</CardDescription>
          </CardHeader>
          <CardContent>
            {pendingApprovals.length === 0 ? (
              <EmptyState
                icon={Server}
                title="No pending approvals"
                description="All actions have been processed."
              />
            ) : (
              <div className="space-y-4">
                {pendingApprovals.map((execution) => (
                  <ApprovalCard
                    key={execution.id}
                    execution={execution}
                    onApprove={() => onApprove(execution.id)}
                    onReject={() => onReject(execution.id)}
                    isPending={isApprovalPending}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="executions">
        <Card>
          <CardHeader>
            <CardTitle>Recent Executions</CardTitle>
            <CardDescription>History of action executions</CardDescription>
          </CardHeader>
          <CardContent>
            {executions.length === 0 ? (
              <EmptyState
                icon={Server}
                title="No executions yet"
                description="Action execution history will appear here."
              />
            ) : (
              <div className="space-y-2">
                {executions.map((execution) => (
                  <ExecutionRow
                    key={execution.id}
                    id={execution.id}
                    actionName={execution.actionName}
                    executedByUsername={execution.executedByUsername}
                    startedAt={execution.startedAt}
                    status={execution.status}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="sql" className="space-y-6">
        {/* SQL Runner content - keeping minimal for now, can be extracted further if needed */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Query Templates
              </CardTitle>
              <CardDescription>Pre-approved parameterized queries</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className={`p-3 rounded-lg border cursor-pointer hover-elevate ${
                    selectedTemplate?.id === template.id
                      ? "border-primary bg-primary/5"
                      : "border-border"
                  }`}
                  onClick={() => onTemplateSelect(template)}
                  data-testid={`template-${template.id}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{template.name}</span>
                    <span className="text-xs text-muted-foreground">{template.type}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{template.description}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                {selectedTemplate ? selectedTemplate.name : "Select a Template"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedTemplate ? (
                <div className="space-y-4">
                  <div className="p-3 rounded-lg bg-muted/50 font-mono text-xs overflow-x-auto">
                    <code>{selectedTemplate.templateSql}</code>
                  </div>
                  {selectedTemplate.params.map((param) => (
                    <div key={param.name} className="space-y-1">
                      <label className="text-sm font-medium">
                        {param.label}
                        {param.required && <span className="text-status-critical ml-1">*</span>}
                      </label>
                      <input
                        type={param.type === "number" ? "number" : param.type === "email" ? "email" : "text"}
                        placeholder={param.placeholder}
                        value={queryParams[param.name] || ""}
                        onChange={(e) =>
                          onQueryParamChange({ ...queryParams, [param.name]: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-border rounded-md bg-background"
                        data-testid={`input-query-${param.name}`}
                      />
                    </div>
                  ))}
                  <button
                    className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-50"
                    onClick={onExecuteQuery}
                    disabled={isExecutingQuery}
                    data-testid="button-execute-query"
                  >
                    {isExecutingQuery ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                        Executing...
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 inline mr-2" />
                        Execute Query
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <EmptyState
                  icon={FileText}
                  title="Select a template"
                  description="Choose a query template to execute."
                />
              )}
            </CardContent>
          </Card>
        </div>

        {queryResult && (
          <Card data-testid="card-query-results">
            <CardHeader>
              <CardTitle>Query Results</CardTitle>
              <CardDescription>
                {queryResult.rowCount} rows returned in {queryResult.executionTimeMs}ms
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {queryResult.columns.map((col) => (
                        <th key={col} className="text-left p-2 font-medium">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {queryResult.rows.map((row, i) => (
                      <tr key={i} className="border-b border-border/50">
                        {queryResult.columns.map((col) => (
                          <td key={col} className="p-2 font-mono text-xs">
                            {String(row[col] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </TabsContent>
    </Tabs>
  );
}
