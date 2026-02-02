/**
 * packages/apps/console/client/src/pages/incidents.tsx
 * Incident views: list + detail (Phase 5).
 */
import * as React from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Activity, ExternalLink, Tags, Play, Clock, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { EmptyState } from "@/components/patterns/EmptyState";
import type { ActionCatalogResponse, ActivityStreamResponse, Event, Severity, WorkflowExecution } from "@shared/schema";

function severityBadgeVariant(sev: Severity): "default" | "secondary" | "destructive" | "outline" {
  if (sev === "critical") return "destructive";
  if (sev === "high") return "default";
  return "secondary";
}

function incidentCandidates(events: Event[]): Event[] {
  const explicit = events.filter((e) => e.contextType === "incident");
  if (explicit.length > 0) return explicit;
  // Fallback (dev/demo data): treat high-signal alerts as incident candidates
  return events.filter((e) => e.type === "alert" && (e.severity === "high" || e.severity === "critical"));
}

function matchesQuery(e: Event, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = `${e.message} ${(e.serviceTags ?? []).join(" ")} ${e.source} ${e.type}`.toLowerCase();
  return hay.includes(q);
}

export default function IncidentsPage(): JSX.Element {
  const [query, setQuery] = React.useState("");

  const streamQuery = useQuery<ActivityStreamResponse>({
    queryKey: ["/api/activity/stream?page=1&pageSize=100"],
    refetchInterval: 15000,
  });

  const allEvents = streamQuery.data?.events ?? [];
  const incidents = incidentCandidates(allEvents);

  const openIncidents = incidents.filter((e) => !e.resolved).filter((e) => matchesQuery(e, query));
  const resolvedIncidents = incidents.filter((e) => e.resolved).filter((e) => matchesQuery(e, query));

  return (
    <div data-testid="incidents-page" className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-semibold">Incidents</h1>
          </div>
          <div className="text-sm text-muted-foreground">
            Operational incidents are represented by activity events with context type <span className="font-mono">incident</span>.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="font-mono text-[10px]">
            open:{openIncidents.length}
          </Badge>
          <Badge variant="outline" className="font-mono text-[10px]">
            resolved:{resolvedIncidents.length}
          </Badge>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search incidents (message, service tag, source)…"
          data-testid="input-incident-search"
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => streamQuery.refetch()}
          disabled={streamQuery.isFetching}
          data-testid="button-refresh-incidents"
        >
          {streamQuery.isFetching ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      <Tabs defaultValue="open">
        <TabsList>
          <TabsTrigger value="open">Open</TabsTrigger>
          <TabsTrigger value="resolved">Resolved</TabsTrigger>
        </TabsList>

        <TabsContent value="open">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Open incidents</CardTitle>
              <CardDescription>Unresolved incident events (auto-refreshing).</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {streamQuery.isLoading ? (
                <div className="p-4 space-y-2">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : openIncidents.length === 0 ? (
                <div className="p-6">
                  <EmptyState
                    icon={CheckCircle2}
                    title="No open incidents"
                    description="You're all clear. If you expect incidents, ensure events are ingested with contextType=incident."
                  />
                </div>
              ) : (
                <ScrollArea className="h-[520px]">
                  <div className="divide-y">
                    {openIncidents
                      .slice()
                      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                      .map((e) => (
                        <Link key={e.id} href={`/incidents/${e.id}`}>
                          <a className="block p-4 hover:bg-accent/40 transition-colors" data-testid={`incident-row-${e.id}`}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <Badge variant={severityBadgeVariant(e.severity)} className="text-[10px] font-mono">
                                    {e.severity}
                                  </Badge>
                                  <Badge variant="outline" className="text-[10px] font-mono">
                                    {e.source}
                                  </Badge>
                                  <Badge variant="secondary" className="text-[10px] font-mono">
                                    {e.type}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground font-mono">
                                    {new Date(e.timestamp).toLocaleString()}
                                  </span>
                                </div>
                                <div className="text-sm font-medium truncate">{e.message}</div>
                                {(e.serviceTags?.length ?? 0) > 0 ? (
                                  <div className="flex flex-wrap gap-1 pt-1">
                                    {(e.serviceTags ?? []).slice(0, 6).map((tag) => (
                                      <Badge key={tag} variant="secondary" className="text-[10px] font-mono">
                                        {tag}
                                      </Badge>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                              <Activity className="h-4 w-4 text-muted-foreground shrink-0" />
                            </div>
                          </a>
                        </Link>
                      ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resolved">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resolved incidents</CardTitle>
              <CardDescription>Recently resolved incident events.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {streamQuery.isLoading ? (
                <div className="p-4 space-y-2">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : resolvedIncidents.length === 0 ? (
                <div className="p-6">
                  <EmptyState icon={AlertTriangle} title="No resolved incidents yet" description="Resolved incidents will appear here." />
                </div>
              ) : (
                <ScrollArea className="h-[520px]">
                  <div className="divide-y">
                    {resolvedIncidents
                      .slice()
                      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                      .map((e) => (
                        <Link key={e.id} href={`/incidents/${e.id}`}>
                          <a className="block p-4 hover:bg-accent/40 transition-colors" data-testid={`incident-row-${e.id}`}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <Badge variant={severityBadgeVariant(e.severity)} className="text-[10px] font-mono">
                                    {e.severity}
                                  </Badge>
                                  <Badge variant="outline" className="text-[10px] font-mono">
                                    {e.source}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground font-mono">
                                    {new Date(e.timestamp).toLocaleString()}
                                  </span>
                                  <Badge variant="secondary" className="text-[10px] font-mono">
                                    resolved
                                  </Badge>
                                </div>
                                <div className="text-sm font-medium truncate">{e.message}</div>
                              </div>
                              <CheckCircle2 className="h-4 w-4 text-status-healthy shrink-0" />
                            </div>
                          </a>
                        </Link>
                      ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function IncidentDetailPage(props: { params: { id: string } }): JSX.Element {
  const incidentId = props.params.id;

  const streamQuery = useQuery<ActivityStreamResponse>({
    queryKey: ["/api/activity/stream?page=1&pageSize=200"],
    refetchInterval: 15000,
  });

  const pendingApprovalsQuery = useQuery<{ executions: WorkflowExecution[]; total?: number }>({
    queryKey: ["/api/actions/approvals/pending"],
    refetchInterval: 5000,
  });

  const executionsQuery = useQuery<{ executions: WorkflowExecution[]; total?: number }>({
    queryKey: ["/api/actions/executions?limit=100"],
    refetchInterval: 5000,
  });

  const actionsQuery = useQuery<ActionCatalogResponse>({
    queryKey: ["/api/actions/catalog"],
  });

  const incident = React.useMemo(() => {
    const all = streamQuery.data?.events ?? [];
    return all.find((e) => e.id === incidentId) ?? null;
  }, [streamQuery.data?.events, incidentId]);

  const setResolvedMutation = useMutation({
    mutationFn: async (payload: { id: string; resolved: boolean }) => {
      const res = await apiRequest("PATCH", `/api/events/${payload.id}`, { resolved: payload.resolved });
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/activity/stream?page=1&pageSize=100"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/activity/stream?page=1&pageSize=200"] });
    },
  });

  if (streamQuery.isLoading) {
    return (
      <div data-testid="incident-detail-loading" className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!incident) {
    return (
      <div data-testid="incident-detail-not-found" className="space-y-4">
        <EmptyState icon={AlertTriangle} title="Incident not found" description="The incident event could not be found in the activity stream." />
        <Link href="/incidents">
          <Button variant="outline">Back to incidents</Button>
        </Link>
      </div>
    );
  }

  const incidentTags = incident.serviceTags ?? [];
  const allEvents = streamQuery.data?.events ?? [];
  const relatedEvents = allEvents.filter((e) => {
    if (e.id === incident.id) return true;
    if (incidentTags.length === 0) return false;
    return (e.serviceTags ?? []).some((t) => incidentTags.includes(t));
  });

  const pendingApprovals = pendingApprovalsQuery.data?.executions ?? [];
  const approvalsForIncident = pendingApprovals.filter((ex) => {
    if (ex.context?.eventId && ex.context.eventId === incident.id) return true;
    if (incidentTags.length === 0) return false;
    return (ex.context?.serviceTags ?? []).some((t) => incidentTags.includes(t));
  });

  const executions = executionsQuery.data?.executions ?? [];
  const executionsForIncident = executions.filter((ex) => {
    if (ex.context?.eventId && ex.context.eventId === incident.id) return true;
    if (incidentTags.length === 0) return false;
    return (ex.context?.serviceTags ?? []).some((t) => incidentTags.includes(t));
  });

  type TimelineItem =
    | { kind: "event"; at: string; event: Event }
    | { kind: "execution"; at: string; execution: WorkflowExecution };

  const timelineItems: TimelineItem[] = [
    ...relatedEvents.map((e) => ({ kind: "event" as const, at: e.timestamp, event: e })),
    ...executionsForIncident.map((ex) => ({ kind: "execution" as const, at: ex.startedAt, execution: ex })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return (
    <div data-testid="incident-detail-page" className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-semibold truncate">{incident.message}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={severityBadgeVariant(incident.severity)} className="font-mono text-[10px]">
              {incident.severity}
            </Badge>
            <Badge variant="outline" className="font-mono text-[10px]">
              {incident.source}
            </Badge>
            <Badge variant="secondary" className="font-mono text-[10px]">
              {incident.type}
            </Badge>
            <span className="text-xs text-muted-foreground font-mono">{new Date(incident.timestamp).toLocaleString()}</span>
            {incident.resolved ? (
              <Badge variant="secondary" className="font-mono text-[10px]">
                resolved
              </Badge>
            ) : (
              <Badge variant="destructive" className="font-mono text-[10px]">
                open
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {incident.externalLink ? (
            <a href={incident.externalLink} target="_blank" rel="noreferrer">
              <Button variant="outline" className="gap-2" data-testid="button-open-external-link">
                <ExternalLink className="h-4 w-4" />
                Open link
              </Button>
            </a>
          ) : null}
          <Button
            type="button"
            variant={incident.resolved ? "outline" : "secondary"}
            onClick={() => setResolvedMutation.mutate({ id: incident.id, resolved: !incident.resolved })}
            disabled={setResolvedMutation.isPending}
            data-testid="button-toggle-resolved"
          >
            {incident.resolved ? "Mark open" : "Mark resolved"}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="approvals">
            Approvals {approvalsForIncident.length > 0 ? `(${approvalsForIncident.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="runbooks">Runbooks</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Context</CardTitle>
              <CardDescription>Key incident context for triage and safe action.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(incident.serviceTags?.length ?? 0) > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <Tags className="h-4 w-4" />
                    Service tags
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(incident.serviceTags ?? []).map((tag) => (
                      <Badge key={tag} variant="secondary" className="font-mono text-[10px]">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  No service tags are attached to this incident. Adding tags improves action relevance and grouping.
                </div>
              )}

              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Raw payload</div>
                <pre className="text-xs p-3 rounded-md bg-muted/40 border border-border overflow-auto">
                  {JSON.stringify(incident.payload ?? {}, null, 2)}
                </pre>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Actions</CardTitle>
              <CardDescription>Use context-aware actions for remediation.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-2">
              <Link href="/operations">
                <Button variant="secondary" className="gap-2">
                  <Play className="h-4 w-4" />
                  Open Operations Hub
                </Button>
              </Link>
              <Link href="/runbooks">
                <Button variant="outline" className="gap-2">
                  <BookOpen className="h-4 w-4" />
                  Browse runbooks
                </Button>
              </Link>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="approvals">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pending approvals</CardTitle>
              <CardDescription>Approvals linked to this incident by event ID or overlapping service tags.</CardDescription>
            </CardHeader>
            <CardContent>
              {pendingApprovalsQuery.isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : approvalsForIncident.length === 0 ? (
                <EmptyState icon={CheckCircle2} title="No pending approvals" description="No incident-scoped approvals are waiting." />
              ) : (
                <div className="space-y-2">
                  {approvalsForIncident.map((ex) => (
                    <div key={ex.id} className="flex items-start justify-between gap-3 p-3 rounded-lg border border-border">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-[10px] font-mono">
                            pending_approval
                          </Badge>
                          <span className="text-sm font-medium truncate">{ex.actionName}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          requested by {ex.executedByUsername} • {new Date(ex.startedAt).toLocaleString()}
                        </div>
                        <div className="text-xs text-muted-foreground line-clamp-2">{ex.reasoning}</div>
                      </div>
                      <Link href="/operations">
                        <Button variant="outline" size="sm">
                          Review
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="runbooks">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recommended runbooks</CardTitle>
              <CardDescription>Runbooks inferred from action targets vs incident service tags.</CardDescription>
            </CardHeader>
            <CardContent>
              {actionsQuery.isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : (
                <>
                  <div className="text-xs text-muted-foreground mb-3">
                    Tip: Runbooks are listed under <span className="font-mono">/runbooks</span> and executable when an action with the same ID exists.
                  </div>
                  <div className="space-y-2">
                    {(actionsQuery.data?.actions ?? [])
                      .filter((a) => a.id.includes("runbook") || a.id.includes("rollback") || a.id.includes("cache") || a.id.includes("redis"))
                      .filter((a) => (incidentTags.length === 0 ? true : (a.targetServices ?? []).some((t) => incidentTags.includes(t))))
                      .slice(0, 8)
                      .map((a) => (
                        <div key={a.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border">
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px] font-mono">
                                {a.riskLevel}
                              </Badge>
                              <span className="text-sm font-medium truncate">{a.name}</span>
                            </div>
                            <div className="text-xs text-muted-foreground line-clamp-2">{a.description}</div>
                          </div>
                          <Link href="/runbooks">
                            <Button variant="outline" size="sm">
                              Open
                            </Button>
                          </Link>
                        </div>
                      ))}
                    <Link href="/runbooks">
                      <Button variant="secondary" className="mt-2">
                        Browse all runbooks
                      </Button>
                    </Link>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Timeline</CardTitle>
              <CardDescription>Unified audit feed (events + executions) scoped by service tags.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {timelineItems.length === 0 ? (
                <div className="p-6">
                  <EmptyState icon={Clock} title="No timeline entries" description="No related events or executions were found for this incident." />
                </div>
              ) : (
                <ScrollArea className="h-[520px]">
                  <div className="divide-y">
                    {timelineItems.map((item) => (
                      <div key={`${item.kind}-${item.at}-${item.kind === "event" ? item.event.id : item.execution.id}`} className="p-4">
                        {item.kind === "event" ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px] font-mono">
                                event:{item.event.type}
                              </Badge>
                              <Badge variant={severityBadgeVariant(item.event.severity)} className="text-[10px] font-mono">
                                {item.event.severity}
                              </Badge>
                              <span className="text-xs text-muted-foreground font-mono">{new Date(item.at).toLocaleString()}</span>
                            </div>
                            <div className="text-sm font-medium">{item.event.message}</div>
                            {(item.event.serviceTags?.length ?? 0) > 0 ? (
                              <div className="flex flex-wrap gap-1 pt-1">
                                {(item.event.serviceTags ?? []).slice(0, 8).map((t) => (
                                  <Badge key={t} variant="secondary" className="text-[10px] font-mono">
                                    {t}
                                  </Badge>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-[10px] font-mono">
                                exec:{item.execution.status}
                              </Badge>
                              <span className="text-xs text-muted-foreground font-mono">{new Date(item.at).toLocaleString()}</span>
                            </div>
                            <div className="text-sm font-medium">{item.execution.actionName}</div>
                            <div className="text-xs text-muted-foreground">
                              by {item.execution.executedByUsername}
                            </div>
                            <div className="text-xs text-muted-foreground line-clamp-2">{item.execution.reasoning}</div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex items-center gap-2">
        <Link href="/incidents">
          <Button variant="outline">Back to incidents</Button>
        </Link>
      </div>
    </div>
  );
}

