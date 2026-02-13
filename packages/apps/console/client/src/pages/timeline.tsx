/**
 * packages/apps/console/client/src/pages/timeline.tsx
 * Global audit timeline (Phase 5).
 */
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock, Activity, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/patterns/EmptyState";
import type { ActivityStreamResponse, Event, WorkflowExecution } from "@shared/schema";

type TimelineItem =
  | { kind: "event"; at: string; event: Event }
  | { kind: "execution"; at: string; execution: WorkflowExecution };

function matchesQuery(item: TimelineItem, q: string): boolean {
  const query = q.trim().toLowerCase();
  if (!query) return true;
  if (item.kind === "event") {
    const e = item.event;
    return `${e.message} ${(e.serviceTags ?? []).join(" ")} ${e.source} ${e.type}`.toLowerCase().includes(query);
  }
  const ex = item.execution;
  return `${ex.actionName} ${ex.status} ${ex.executedByUsername} ${ex.reasoning} ${(ex.context?.serviceTags ?? []).join(" ")}`
    .toLowerCase()
    .includes(query);
}

export default function TimelinePage(): JSX.Element {
  const [query, setQuery] = React.useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("q") ?? "";
  });

  const streamQuery = useQuery<ActivityStreamResponse>({
    queryKey: ["/api/activity/stream?page=1&pageSize=200"],
    refetchInterval: 15000,
  });

  const executionsQuery = useQuery<{ executions: WorkflowExecution[]; total?: number }>({
    queryKey: ["/api/actions/executions?limit=200"],
    refetchInterval: 5000,
  });

  const events = streamQuery.data?.events ?? [];
  const executions = executionsQuery.data?.executions ?? [];

  const items: TimelineItem[] = React.useMemo(() => {
    const combined: TimelineItem[] = [
      ...events.map((e) => ({ kind: "event" as const, at: e.timestamp, event: e })),
      ...executions.map((ex) => ({ kind: "execution" as const, at: ex.startedAt, execution: ex })),
    ];
    return combined
      .filter((i) => matchesQuery(i, query))
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [events, executions, query]);

  const loading = streamQuery.isLoading || executionsQuery.isLoading;

  return (
    <div data-testid="timeline-page" className="space-y-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold">Timeline</h1>
        </div>
        <div className="text-sm text-muted-foreground">Global audit feed across events and workflow executions.</div>
      </div>

      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search timeline (message, action, user, tags)…"
        data-testid="input-timeline-search"
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Audit feed</CardTitle>
          <CardDescription>
            Showing {items.length} entries • events:{events.length} • executions:{executions.length}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : items.length === 0 ? (
            <div className="p-6">
              <EmptyState icon={Clock} title="No entries" description="No events/executions match the current filters." />
            </div>
          ) : (
            <ScrollArea className="h-[620px]">
              <div className="divide-y">
                {items.map((item) => (
                  <div key={`${item.kind}-${item.at}-${item.kind === "event" ? item.event.id : item.execution.id}`} className="p-4">
                    {item.kind === "event" ? (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Activity className="h-4 w-4 text-muted-foreground" />
                          <Badge variant="outline" className="text-[10px] font-mono">
                            {item.event.source}:{item.event.type}
                          </Badge>
                          <span className="text-xs text-muted-foreground font-mono">
                            {new Date(item.at).toLocaleString()}
                          </span>
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
                          <Play className="h-4 w-4 text-muted-foreground" />
                          <Badge variant="secondary" className="text-[10px] font-mono">
                            {item.execution.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground font-mono">
                            {new Date(item.at).toLocaleString()}
                          </span>
                        </div>
                        <div className="text-sm font-medium">{item.execution.actionName}</div>
                        <div className="text-xs text-muted-foreground">by {item.execution.executedByUsername}</div>
                        {(item.execution.context?.serviceTags?.length ?? 0) > 0 ? (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {(item.execution.context?.serviceTags ?? []).slice(0, 8).map((t) => (
                              <Badge key={t} variant="secondary" className="text-[10px] font-mono">
                                {t}
                              </Badge>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

