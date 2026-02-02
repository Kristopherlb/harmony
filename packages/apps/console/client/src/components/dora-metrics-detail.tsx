import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import type { Event, DORAMetrics, EventSource } from "@shared/schema";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { StatusIndicator } from "./status-indicator";
import { EventDetailSheet } from "./event-detail-sheet";
import { UserProfileSheet } from "./user-profile-sheet";
import {
  Rocket,
  Timer,
  AlertTriangle,
  Activity,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  XCircle,
  GitBranch,
  Database,
  ChevronRight,
  ExternalLink,
  Wrench,
} from "lucide-react";
import { SiSlack, SiJira, SiGitlab, SiBitbucket, SiCircleci } from "react-icons/si";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

interface DORAMetricsDetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metrics: DORAMetrics | null;
  initialTab?: "deployment" | "leadtime" | "mttr" | "cfr";
}

interface ActivityStreamResponse {
  events: Event[];
  total: number;
}

const sourceIcons: Record<EventSource, React.ReactNode> = {
  slack: <SiSlack className="h-4 w-4" />,
  jira: <SiJira className="h-4 w-4" />,
  gitlab: <SiGitlab className="h-4 w-4" />,
  bitbucket: <SiBitbucket className="h-4 w-4" />,
  pagerduty: <AlertTriangle className="h-4 w-4" />,
  circleci: <SiCircleci className="h-4 w-4" />,
};

const sourceColors: Record<EventSource, string> = {
  slack: "text-primary bg-primary/10 border-primary/30",
  jira: "text-primary bg-primary/10 border-primary/30",
  gitlab: "text-primary bg-primary/10 border-primary/30",
  bitbucket: "text-primary bg-primary/10 border-primary/30",
  pagerduty: "text-status-healthy bg-status-healthy/10 border-status-healthy/30",
  circleci: "text-primary bg-primary/10 border-primary/30",
};

const sourceLabels: Record<EventSource, string> = {
  slack: "Slack",
  jira: "Jira",
  gitlab: "GitLab",
  bitbucket: "Bitbucket",
  pagerduty: "PagerDuty",
  circleci: "CircleCI",
};

export function DORAMetricsDetail({ 
  open, 
  onOpenChange, 
  metrics,
  initialTab = "deployment" 
}: DORAMetricsDetailProps) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [selectedSource, setSelectedSource] = useState<EventSource | null>(null);
  const [sourceEvents, setSourceEvents] = useState<Event[]>([]);
  const [sourceViewOpen, setSourceViewOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [eventDetailOpen, setEventDetailOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [userProfileOpen, setUserProfileOpen] = useState(false);

  const handleUserClick = (username: string) => {
    setSelectedUser(username);
    setUserProfileOpen(true);
  };

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const eventsQuery = useQuery<ActivityStreamResponse>({
    queryKey: ["/api/activity/stream?pageSize=200"],
    queryFn: async () => {
      const res = await fetch("/api/activity/stream?pageSize=200", { credentials: "include" });
      if (!res.ok) {
        const text = (await res.text()) || res.statusText;
        throw new Error(`${res.status}: ${text}`);
      }
      return (await res.json()) as ActivityStreamResponse;
    },
    enabled: open,
  });

  const events = eventsQuery.data?.events ?? [];
  const releases = events.filter(e => e.type === "release");
  const blockers = events.filter(e => e.type === "blocker");
  const alerts = events.filter(e => e.type === "alert");
  const resolvedBlockers = blockers.filter(e => e.resolved);
  const failedReleases = releases.filter(e => (e.payload as Record<string, unknown>).failed === true);

  const handleSourceClick = (source: EventSource, eventList: Event[]) => {
    const filtered = eventList.filter(e => e.source === source);
    setSelectedSource(source);
    setSourceEvents(filtered);
    setSourceViewOpen(true);
  };

  const handleEventClick = (event: Event) => {
    setSelectedEvent(event);
    setEventDetailOpen(true);
  };

  if (!metrics) return null;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-2xl font-mono overflow-y-auto" data-testid="dora-metrics-detail">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              DORA Metrics Details
            </SheetTitle>
            <SheetDescription>
              Drill down into deployment frequency, lead time, MTTR, and change failure rate
            </SheetDescription>
          </SheetHeader>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="mt-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="deployment" className="text-xs" data-testid="tab-deployment">
                Deploys
              </TabsTrigger>
              <TabsTrigger value="leadtime" className="text-xs" data-testid="tab-leadtime">
                Lead Time
              </TabsTrigger>
              <TabsTrigger value="mttr" className="text-xs" data-testid="tab-mttr">
                MTTR
              </TabsTrigger>
              <TabsTrigger value="cfr" className="text-xs" data-testid="tab-cfr">
                Failure Rate
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="h-[calc(100vh-220px)] mt-4">
              <TabsContent value="deployment" className="space-y-4 pr-4">
                <DeploymentFrequencyDetail 
                  frequency={metrics.deploymentFrequency} 
                  releases={releases}
                  onSourceClick={handleSourceClick}
                  onEventClick={handleEventClick}
                />
              </TabsContent>

              <TabsContent value="leadtime" className="space-y-4 pr-4">
                <LeadTimeDetail 
                  leadTime={metrics.leadTime} 
                  releases={releases}
                  onSourceClick={handleSourceClick}
                />
              </TabsContent>

              <TabsContent value="mttr" className="space-y-4 pr-4">
                <MTTRDetail 
                  mttr={metrics.meanTimeToRecovery} 
                  blockers={blockers}
                  resolvedBlockers={resolvedBlockers}
                  alerts={alerts}
                  onSourceClick={handleSourceClick}
                />
              </TabsContent>

              <TabsContent value="cfr" className="space-y-4 pr-4">
                <ChangeFailureRateDetail 
                  cfr={metrics.changeFailureRate} 
                  releases={releases}
                  failedReleases={failedReleases}
                  blockers={blockers}
                  alerts={alerts}
                  onSourceClick={handleSourceClick}
                />
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </SheetContent>
      </Sheet>

      <SourceEventsSheet
        open={sourceViewOpen}
        onOpenChange={setSourceViewOpen}
        source={selectedSource}
        events={sourceEvents}
        onEventClick={handleEventClick}
      />

      <EventDetailSheet
        event={selectedEvent}
        open={eventDetailOpen}
        onOpenChange={setEventDetailOpen}
        onUserClick={handleUserClick}
      />

      <UserProfileSheet
        username={selectedUser}
        open={userProfileOpen}
        onOpenChange={setUserProfileOpen}
        onEventClick={handleEventClick}
      />
    </>
  );
}

interface SourceEventsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: EventSource | null;
  events: Event[];
  onEventClick: (event: Event) => void;
}

function SourceEventsSheet({ open, onOpenChange, source, events, onEventClick }: SourceEventsSheetProps) {
  if (!source) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl font-mono overflow-y-auto" data-testid="source-events-sheet">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <span className={sourceColors[source].split(' ')[0]}>
              {sourceIcons[source]}
            </span>
            {sourceLabels[source]} Events
          </SheetTitle>
          <SheetDescription>
            {events.length} events from {sourceLabels[source]}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6">
          {events.length === 0 ? (
            <Card className="p-6 text-center">
              <p className="text-muted-foreground">No events from this source</p>
            </Card>
          ) : (
            <ScrollArea className="h-[calc(100vh-180px)]">
              <div className="space-y-2 pr-4">
                {events.map((event) => (
                  <SourceEventCard
                    key={event.id}
                    event={event}
                    onClick={() => onEventClick(event)}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface SourceEventCardProps {
  event: Event;
  onClick: () => void;
}

function SourceEventCard({ event, onClick }: SourceEventCardProps) {
  const payload = event.payload as Record<string, unknown>;
  
  return (
    <div
      className="group rounded-md border border-border bg-card/50 p-3 cursor-pointer hover-elevate"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      data-testid={`source-event-${event.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Badge variant={event.severity === "critical" ? "destructive" : "secondary"} className="text-xs">
              {event.type}
            </Badge>
            {payload.leadTimeHours !== undefined && (
              <Badge variant="outline" className="text-xs">
                {String(payload.leadTimeHours)}h lead time
              </Badge>
            )}
            {payload.failed === true && (
              <Badge variant="destructive" className="text-xs">
                Failed
              </Badge>
            )}
          </div>
          <p className="text-sm truncate">{event.message}</p>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}</span>
            {event.username && <span>by {event.username}</span>}
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
}

interface DataSourcesProps {
  events: Event[];
  onSourceClick: (source: EventSource, events: Event[]) => void;
  label?: string;
}

function DataSources({ events, onSourceClick, label = "Data Sources" }: DataSourcesProps) {
  const sourceCounts = events.reduce((acc, event) => {
    acc[event.source] = (acc[event.source] || 0) + 1;
    return acc;
  }, {} as Record<EventSource, number>);

  const sources = Object.entries(sourceCounts) as [EventSource, number][];

  if (sources.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Database className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </h4>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {sources.map(([source, count]) => (
          <Card
            key={source}
            className={cn(
              "group p-3 cursor-pointer border transition-all hover-elevate",
              sourceColors[source]
            )}
            onClick={() => onSourceClick(source, events)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSourceClick(source, events);
              }
            }}
            data-testid={`data-source-${source}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {sourceIcons[source]}
                <span className="text-sm font-medium">{sourceLabels[source]}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-lg font-bold">{count}</span>
                <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

interface DetailProps {
  onSourceClick: (source: EventSource, events: Event[]) => void;
  onEventClick?: (event: Event) => void;
}

function DeploymentFrequencyDetail({ frequency, releases, onSourceClick }: { frequency: number; releases: Event[] } & DetailProps) {
  const rating = getDeploymentRating(frequency);
  
  // Filter state management
  const [activeFilters, setActiveFilters] = useState<{
    day?: string;
    type?: string;
    status?: 'all' | 'success' | 'failed';
  }>({});

  // Apply filters to releases
  const filteredReleases = useMemo(() => {
    let filtered = [...releases];
    
    if (activeFilters.status === 'success') {
      filtered = filtered.filter(r => (r.payload as Record<string, unknown>).failed !== true);
    } else if (activeFilters.status === 'failed') {
      filtered = filtered.filter(r => (r.payload as Record<string, unknown>).failed === true);
    }
    
    if (activeFilters.day) {
      filtered = filtered.filter(r => 
        format(new Date(r.timestamp), "EEE") === activeFilters.day
      );
    }
    
    if (activeFilters.type) {
      filtered = filtered.filter(r => {
        const payload = r.payload as Record<string, unknown>;
        // CircleCI-specific type detection
        if (r.source === "circleci") {
          const workflowName = (payload.workflowName as string || "").toLowerCase();
          const branch = (payload.branch as string || "").toLowerCase();
          
          if (activeFilters.type === "production") {
            return workflowName.includes("prod") || workflowName.includes("production");
          }
          if (activeFilters.type === "staging") {
            return workflowName.includes("staging") || workflowName.includes("stage");
          }
          if (activeFilters.type === "hotfix") {
            return branch.includes("hotfix") || branch.includes("fix");
          }
        }
        // Fallback to message-based detection for other sources
        const msg = r.message.toLowerCase();
        if (activeFilters.type === "production") {
          return msg.includes("production") || msg.includes("prod");
        }
        if (activeFilters.type === "staging") {
          return msg.includes("beta") || msg.includes("staging");
        }
        if (activeFilters.type === "hotfix") {
          return msg.includes("hotfix");
        }
        if (activeFilters.type === "other") {
          return !msg.includes("hotfix") && !msg.includes("beta") && !msg.includes("staging") && !msg.includes("production") && !msg.includes("prod");
        }
        return true;
      });
    }
    
    return filtered;
  }, [releases, activeFilters]);

  const recentReleases = filteredReleases.slice(0, 10);
  const successfulReleases = releases.filter(r => (r.payload as Record<string, unknown>).failed !== true);
  const failedReleases = releases.filter(r => (r.payload as Record<string, unknown>).failed === true);

  const resetFilters = () => {
    setActiveFilters({});
  };

  const deploymentsByDay = releases.reduce((acc, release) => {
    const day = format(new Date(release.timestamp), "EEE");
    acc[day] = (acc[day] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const daysOrder = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const maxDeploysPerDay = Math.max(...Object.values(deploymentsByDay), 1);

  const deploymentVersions = releases.reduce((acc, release) => {
    const msg = release.message.toLowerCase();
    if (msg.includes("hotfix")) acc.hotfix = (acc.hotfix || 0) + 1;
    else if (msg.includes("beta") || msg.includes("staging")) acc.staging = (acc.staging || 0) + 1;
    else if (msg.includes("production") || msg.includes("prod")) acc.production = (acc.production || 0) + 1;
    else acc.other = (acc.other || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const hasActiveFilters = Object.keys(activeFilters).length > 0;

  return (
    <div className="space-y-4">
      <div
        onClick={resetFilters}
        className="cursor-pointer"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            resetFilters();
          }
        }}
      >
        <MetricSummaryCard
          icon={<Rocket className="h-5 w-5" />}
          title="Deployment Frequency"
          value={`${frequency.toFixed(2)}/day`}
          rating={rating}
          description="Average number of deployments per day over the last 30 days"
        />
      </div>

      <div className="grid grid-cols-4 gap-2">
        <Card 
          className={cn("p-3 cursor-pointer transition-colors hover-elevate", activeFilters.status === undefined && hasActiveFilters ? "border-primary bg-primary/5" : "")}
          onClick={resetFilters}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              resetFilters();
            }
          }}
        >
          <div className="text-xs text-muted-foreground mb-1">Total</div>
          <div className="text-xl font-bold">{releases.length}</div>
        </Card>
        <Card 
          className={cn("p-3 cursor-pointer transition-colors hover-elevate", activeFilters.status === 'success' ? "border-status-healthy bg-status-healthy/5" : "")}
          onClick={() => setActiveFilters(prev => ({ ...prev, status: prev.status === 'success' ? undefined : 'success' }))}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setActiveFilters(prev => ({ ...prev, status: prev.status === 'success' ? undefined : 'success' }));
            }
          }}
        >
          <div className="text-xs text-muted-foreground mb-1">Successful</div>
          <div className="text-xl font-bold text-status-healthy">{successfulReleases.length}</div>
        </Card>
        <Card 
          className={cn("p-3 cursor-pointer transition-colors hover-elevate", activeFilters.status === 'failed' ? "border-status-critical bg-status-critical/5" : "")}
          onClick={() => setActiveFilters(prev => ({ ...prev, status: prev.status === 'failed' ? undefined : 'failed' }))}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setActiveFilters(prev => ({ ...prev, status: prev.status === 'failed' ? undefined : 'failed' }));
            }
          }}
        >
          <div className="text-xs text-muted-foreground mb-1">Failed</div>
          <div className="text-xl font-bold text-status-critical">{failedReleases.length}</div>
        </Card>
        <Card 
          className="p-3 cursor-pointer transition-colors hover-elevate"
          onClick={() => setActiveFilters(prev => ({ ...prev, status: prev.status === 'success' ? undefined : 'success' }))}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setActiveFilters(prev => ({ ...prev, status: prev.status === 'success' ? undefined : 'success' }));
            }
          }}
        >
          <div className="text-xs text-muted-foreground mb-1">Success Rate</div>
          <div className="text-xl font-bold text-primary">
            {releases.length > 0 ? Math.round((successfulReleases.length / releases.length) * 100) : 0}%
          </div>
        </Card>
      </div>

      <Separator />

      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Deploys by Day of Week
        </h4>
        <div className="flex items-end gap-1 h-16">
          {daysOrder.map(day => {
            const count = deploymentsByDay[day] || 0;
            const height = (count / maxDeploysPerDay) * 100;
            const isActive = activeFilters.day === day;
            return (
              <div key={day} className="flex-1 flex flex-col items-center gap-1">
                <div 
                  className={cn(
                    "w-full rounded-t transition-all cursor-pointer",
                    count > 0 ? "bg-primary" : "bg-muted",
                    isActive ? "ring-2 ring-primary ring-offset-2" : ""
                  )}
                  style={{ height: `${Math.max(height, 4)}%` }}
                  title={`${day}: ${count} deploys`}
                  onClick={() => setActiveFilters(prev => ({ ...prev, day: prev.day === day ? undefined : day }))}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setActiveFilters(prev => ({ ...prev, day: prev.day === day ? undefined : day }));
                    }
                  }}
                />
                <span className="text-[10px] text-muted-foreground">{day}</span>
              </div>
            );
          })}
        </div>
      </div>

      <Separator />

      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Deployment Types
        </h4>
        <div className="grid grid-cols-4 gap-2">
          <Card 
            className={cn("p-2 text-center cursor-pointer transition-colors hover-elevate", activeFilters.type === "production" ? "border-status-healthy bg-status-healthy/5" : "")}
            onClick={() => setActiveFilters(prev => ({ ...prev, type: prev.type === "production" ? undefined : "production" }))}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setActiveFilters(prev => ({ ...prev, type: prev.type === "production" ? undefined : "production" }));
              }
            }}
          >
            <div className="text-xs text-muted-foreground mb-1">Production</div>
            <div className="text-lg font-bold text-status-healthy">{deploymentVersions.production || 0}</div>
          </Card>
          <Card 
            className={cn("p-2 text-center cursor-pointer transition-colors hover-elevate", activeFilters.type === "staging" ? "border-primary bg-primary/5" : "")}
            onClick={() => setActiveFilters(prev => ({ ...prev, type: prev.type === "staging" ? undefined : "staging" }))}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setActiveFilters(prev => ({ ...prev, type: prev.type === "staging" ? undefined : "staging" }));
              }
            }}
          >
            <div className="text-xs text-muted-foreground mb-1">Staging</div>
            <div className="text-lg font-bold text-primary">{deploymentVersions.staging || 0}</div>
          </Card>
          <Card 
            className={cn("p-2 text-center cursor-pointer transition-colors hover-elevate", activeFilters.type === "hotfix" ? "border-status-degraded bg-status-degraded/5" : "")}
            onClick={() => setActiveFilters(prev => ({ ...prev, type: prev.type === "hotfix" ? undefined : "hotfix" }))}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setActiveFilters(prev => ({ ...prev, type: prev.type === "hotfix" ? undefined : "hotfix" }));
              }
            }}
          >
            <div className="text-xs text-muted-foreground mb-1">Hotfix</div>
            <div className="text-lg font-bold text-status-degraded">{deploymentVersions.hotfix || 0}</div>
          </Card>
          <Card 
            className={cn("p-2 text-center cursor-pointer transition-colors hover-elevate", activeFilters.type === "other" ? "border-border bg-muted/50" : "")}
            onClick={() => setActiveFilters(prev => ({ ...prev, type: prev.type === "other" ? undefined : "other" }))}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setActiveFilters(prev => ({ ...prev, type: prev.type === "other" ? undefined : "other" }));
              }
            }}
          >
            <div className="text-xs text-muted-foreground mb-1">Other</div>
            <div className="text-lg font-bold text-muted-foreground">{deploymentVersions.other || 0}</div>
          </Card>
        </div>
      </div>

      <Separator />

      <DataSources 
        events={releases} 
        onSourceClick={onSourceClick}
        label="Release Sources"
      />

      <Separator />

      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Recent Deployments ({hasActiveFilters ? `${filteredReleases.length} of ${releases.length}` : releases.length} total)
          </h4>
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="text-xs text-primary hover:underline cursor-pointer"
              data-testid="clear-filters-button"
            >
              Clear filters
            </button>
          )}
        </div>
        <div className="space-y-2">
          {recentReleases.length === 0 ? (
            <Card className="p-4 text-center text-muted-foreground text-sm">
              {hasActiveFilters ? "No deployments match the current filters" : "No deployments recorded"}
            </Card>
          ) : (
            recentReleases.map((release) => (
              <ReleaseCard key={release.id} event={release} onClick={() => onEventClick?.(release)} />
            ))
          )}
        </div>
      </div>

      <PerformanceBenchmark 
        metric="Deployment Frequency"
        value={frequency}
        elite=">1/day"
        high="1/week - 1/day"
        medium="1/month - 1/week"
        low="<1/month"
      />
    </div>
  );
}

function LeadTimeDetail({ leadTime, releases, onSourceClick }: { leadTime: number; releases: Event[] } & DetailProps) {
  const rating = getLeadTimeRating(leadTime);
  const releasesWithLeadTime = releases.filter(r => 
    (r.payload as Record<string, unknown>).leadTimeHours !== undefined
  );

  const leadTimeData = releasesWithLeadTime.map(r => ({
    ...r,
    hours: (r.payload as Record<string, unknown>).leadTimeHours as number
  }));

  const sortedByLeadTime = [...leadTimeData].sort((a, b) => b.hours - a.hours);
  const fastestReleases = [...leadTimeData].sort((a, b) => a.hours - b.hours).slice(0, 3);
  const slowestReleases = sortedByLeadTime.slice(0, 3);

  const avgLeadTime = leadTimeData.length > 0 
    ? leadTimeData.reduce((sum, r) => sum + r.hours, 0) / leadTimeData.length 
    : 0;
  const minLeadTime = leadTimeData.length > 0 ? Math.min(...leadTimeData.map(r => r.hours)) : 0;
  const maxLeadTime = leadTimeData.length > 0 ? Math.max(...leadTimeData.map(r => r.hours)) : 0;

  const leadTimeBuckets = {
    under1h: leadTimeData.filter(r => r.hours < 1).length,
    under6h: leadTimeData.filter(r => r.hours >= 1 && r.hours < 6).length,
    under24h: leadTimeData.filter(r => r.hours >= 6 && r.hours < 24).length,
    under48h: leadTimeData.filter(r => r.hours >= 24 && r.hours < 48).length,
    over48h: leadTimeData.filter(r => r.hours >= 48).length,
  };

  const bottleneckIndicators = leadTimeData.reduce((acc, r) => {
    if (r.hours > 24) {
      const msg = r.message.toLowerCase();
      if (msg.includes("review") || msg.includes("pr") || msg.includes("merge")) {
        acc["Code Review"] = (acc["Code Review"] || 0) + 1;
      } else if (msg.includes("test") || msg.includes("qa")) {
        acc["Testing/QA"] = (acc["Testing/QA"] || 0) + 1;
      } else if (msg.includes("deploy") || msg.includes("release")) {
        acc["Deployment Pipeline"] = (acc["Deployment Pipeline"] || 0) + 1;
      } else if (msg.includes("approval") || msg.includes("sign-off")) {
        acc["Approval Process"] = (acc["Approval Process"] || 0) + 1;
      } else {
        acc["Other Delays"] = (acc["Other Delays"] || 0) + 1;
      }
    }
    return acc;
  }, {} as Record<string, number>);

  const sortedBottlenecks = Object.entries(bottleneckIndicators)
    .sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-4">
      <MetricSummaryCard
        icon={<Timer className="h-5 w-5" />}
        title="Lead Time for Changes"
        value={`${leadTime.toFixed(1)} hours`}
        rating={rating}
        description="Average time from commit to production deployment"
      />

      <div className="grid grid-cols-4 gap-2">
        <Card className="p-3">
          <div className="text-xs text-muted-foreground mb-1">Releases</div>
          <div className="text-xl font-bold">{leadTimeData.length}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground mb-1">Average</div>
          <div className="text-xl font-bold text-primary">{avgLeadTime.toFixed(1)}h</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground mb-1">Fastest</div>
          <div className="text-xl font-bold text-status-healthy">{minLeadTime.toFixed(1)}h</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground mb-1">Slowest</div>
          <div className="text-xl font-bold text-status-critical">{maxLeadTime.toFixed(1)}h</div>
        </Card>
      </div>

      <Separator />

      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Lead Time Distribution
        </h4>
        <div className="grid grid-cols-5 gap-2">
          <Card className={cn("p-2 text-center border", leadTimeBuckets.under1h > 0 ? "border-status-healthy/30 bg-status-healthy/5" : "")}>
            <div className="text-xs text-muted-foreground mb-1">&lt;1h</div>
            <div className="text-lg font-bold text-status-healthy">{leadTimeBuckets.under1h}</div>
          </Card>
          <Card className={cn("p-2 text-center border", leadTimeBuckets.under6h > 0 ? "border-primary/30 bg-primary/5" : "")}>
            <div className="text-xs text-muted-foreground mb-1">1-6h</div>
            <div className="text-lg font-bold text-primary">{leadTimeBuckets.under6h}</div>
          </Card>
          <Card className={cn("p-2 text-center border", leadTimeBuckets.under24h > 0 ? "border-primary/30 bg-primary/5" : "")}>
            <div className="text-xs text-muted-foreground mb-1">6-24h</div>
            <div className="text-lg font-bold text-primary">{leadTimeBuckets.under24h}</div>
          </Card>
          <Card className={cn("p-2 text-center border", leadTimeBuckets.under48h > 0 ? "border-status-degraded/30 bg-status-degraded/5" : "")}>
            <div className="text-xs text-muted-foreground mb-1">1-2d</div>
            <div className="text-lg font-bold text-status-degraded">{leadTimeBuckets.under48h}</div>
          </Card>
          <Card className={cn("p-2 text-center border", leadTimeBuckets.over48h > 0 ? "border-status-critical/30 bg-status-critical/5" : "")}>
            <div className="text-xs text-muted-foreground mb-1">&gt;2d</div>
            <div className="text-lg font-bold text-status-critical">{leadTimeBuckets.over48h}</div>
          </Card>
        </div>
      </div>

      {sortedBottlenecks.length > 0 && (
        <>
          <Separator />
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Potential Bottlenecks (releases &gt;24h)
            </h4>
            <div className="space-y-2">
              {sortedBottlenecks.map(([bottleneck, count]) => (
                <div key={bottleneck} className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-status-degraded" />
                  <div className="flex-1 flex items-center justify-between">
                    <span className="text-sm">{bottleneck}</span>
                    <span className="text-sm text-muted-foreground">{count} releases</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <Separator />

      <DataSources 
        events={releasesWithLeadTime} 
        onSourceClick={onSourceClick}
        label="Lead Time Sources"
      />

      <div className="grid grid-cols-2 gap-4">
        {fastestReleases.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Fastest Releases
            </h4>
            <div className="space-y-2">
              {fastestReleases.map((release) => (
                <Card key={release.id} className="p-2 border-emerald-500/20">
                  <div className="flex items-center justify-between">
                    <span className="text-xs truncate max-w-[120px]">{release.message}</span>
                    <Badge variant="outline" className="text-status-healthy border-status-healthy/50 text-xs">
                      {release.hours}h
                    </Badge>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
        {slowestReleases.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Slowest Releases
            </h4>
            <div className="space-y-2">
              {slowestReleases.map((release) => (
                <Card key={release.id} className="p-2 border-status-critical/20">
                  <div className="flex items-center justify-between">
                    <span className="text-xs truncate max-w-[120px]">{release.message}</span>
                    <Badge variant="outline" className="text-status-critical border-status-critical/50 text-xs">
                      {release.hours}h
                    </Badge>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      <PerformanceBenchmark 
        metric="Lead Time"
        value={leadTime}
        elite="<1 hour"
        high="1 hour - 1 day"
        medium="1 day - 1 week"
        low=">1 week"
      />
    </div>
  );
}

function MTTRDetail({ 
  mttr, 
  blockers, 
  resolvedBlockers,
  alerts,
  onSourceClick
}: { 
  mttr: number; 
  blockers: Event[];
  resolvedBlockers: Event[];
  alerts: Event[];
} & DetailProps) {
  const rating = getMTTRRating(mttr);
  const allIncidents = [...blockers, ...alerts];
  const openIncidents = blockers.filter(b => !b.resolved);

  const servicePatterns = allIncidents.reduce((acc, incident) => {
    const msg = incident.message.toLowerCase();
    let service = "Other";
    if (msg.includes("payment") || msg.includes("checkout")) service = "Payment/Checkout";
    else if (msg.includes("database") || msg.includes("db") || msg.includes("connection pool")) service = "Database";
    else if (msg.includes("api") || msg.includes("gateway")) service = "API Gateway";
    else if (msg.includes("notification") || msg.includes("email")) service = "Notifications";
    else if (msg.includes("auth") || msg.includes("session")) service = "Authentication";
    else if (msg.includes("memory") || msg.includes("cpu") || msg.includes("disk")) service = "Infrastructure";
    else if (msg.includes("ci") || msg.includes("pipeline") || msg.includes("integration test")) service = "CI/CD";
    
    acc[service] = (acc[service] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const sortedServices = Object.entries(servicePatterns)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const incidentsByDuration = resolvedBlockers.map(b => {
    const duration = b.resolvedAt 
      ? (new Date(b.resolvedAt).getTime() - new Date(b.timestamp).getTime()) / 3600000 
      : 0;
    return { ...b, duration };
  }).sort((a, b) => b.duration - a.duration);

  const durationBuckets = {
    under1h: incidentsByDuration.filter(i => i.duration < 1).length,
    under6h: incidentsByDuration.filter(i => i.duration >= 1 && i.duration < 6).length,
    under24h: incidentsByDuration.filter(i => i.duration >= 6 && i.duration < 24).length,
    over24h: incidentsByDuration.filter(i => i.duration >= 24).length,
  };

  return (
    <div className="space-y-4">
      <MetricSummaryCard
        icon={<Clock className="h-5 w-5" />}
        title="Mean Time to Recovery"
        value={`${mttr.toFixed(1)} hours`}
        rating={rating}
        description="Average time to restore service after an incident"
      />

      <div className="grid grid-cols-4 gap-2">
        <Card className="p-3">
          <div className="text-xs text-muted-foreground mb-1">Total Incidents</div>
          <div className="text-xl font-bold">{blockers.length}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground mb-1">Active Alerts</div>
          <div className="text-xl font-bold text-status-degraded">{alerts.length}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground mb-1">Open</div>
          <div className="text-xl font-bold text-status-critical">{openIncidents.length}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground mb-1">Resolved</div>
          <div className="text-xl font-bold text-status-healthy">{resolvedBlockers.length}</div>
        </Card>
      </div>

      {openIncidents.length > 0 && (
        <Card className="p-3 border-status-degraded/30 bg-status-degraded/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-status-degraded">
              <Wrench className="h-4 w-4" />
              <span className="text-sm font-medium">Incident Response Available</span>
            </div>
            <Link
              href="/operations"
              className="flex items-center gap-1 text-xs text-status-degraded hover:text-status-degraded/80"
              data-testid="link-mttr-ops-hub"
            >
              <span>Open Operations Hub</span>
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Use runbooks and remediation actions to reduce recovery time
          </p>
        </Card>
      )}

      <Separator />

      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Most Affected Services
        </h4>
        <div className="space-y-2">
          {sortedServices.map(([service, count], idx) => (
            <div key={service} className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-4">{idx + 1}</span>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{service}</span>
                  <span className="text-sm text-muted-foreground">{count} incidents</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-status-critical rounded-full"
                    style={{ width: `${(count / allIncidents.length) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Recovery Time Distribution
        </h4>
        <div className="grid grid-cols-4 gap-2">
          <Card className={cn("p-3 border", durationBuckets.under1h > 0 ? "border-status-healthy/30 bg-status-healthy/5" : "")}>
            <div className="text-xs text-muted-foreground mb-1">&lt; 1 hour</div>
            <div className="text-xl font-bold text-status-healthy">{durationBuckets.under1h}</div>
          </Card>
          <Card className={cn("p-3 border", durationBuckets.under6h > 0 ? "border-primary/30 bg-primary/5" : "")}>
            <div className="text-xs text-muted-foreground mb-1">1-6 hours</div>
            <div className="text-xl font-bold text-primary">{durationBuckets.under6h}</div>
          </Card>
          <Card className={cn("p-3 border", durationBuckets.under24h > 0 ? "border-status-degraded/30 bg-status-degraded/5" : "")}>
            <div className="text-xs text-muted-foreground mb-1">6-24 hours</div>
            <div className="text-xl font-bold text-status-degraded">{durationBuckets.under24h}</div>
          </Card>
          <Card className={cn("p-3 border", durationBuckets.over24h > 0 ? "border-status-critical/30 bg-status-critical/5" : "")}>
            <div className="text-xs text-muted-foreground mb-1">&gt; 24 hours</div>
            <div className="text-xl font-bold text-status-critical">{durationBuckets.over24h}</div>
          </Card>
        </div>
      </div>

      <Separator />

      <DataSources 
        events={allIncidents} 
        onSourceClick={onSourceClick}
        label="Incident Sources"
      />

      {incidentsByDuration.length > 0 && (
        <>
          <Separator />
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Longest Recovery Times
            </h4>
            <div className="space-y-2">
              {incidentsByDuration.slice(0, 5).map((incident) => (
                <Card key={incident.id} className="p-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <StatusIndicator severity={incident.severity} size="sm" />
                      <span className="text-sm font-medium truncate max-w-[200px]">{incident.message}</span>
                    </div>
                    <Badge variant="outline" className={cn(
                      incident.duration < 1 ? "text-status-healthy border-status-healthy/50" :
                      incident.duration < 6 ? "text-primary border-primary/50" :
                      incident.duration < 24 ? "text-status-degraded border-status-degraded/50" :
                      "text-status-critical border-status-critical/50"
                    )}>
                      {incident.duration.toFixed(1)}h to recover
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(incident.timestamp), "MMM d, HH:mm")} - Resolved {formatDistanceToNow(new Date(incident.resolvedAt!), { addSuffix: true })}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </>
      )}

      <PerformanceBenchmark 
        metric="MTTR"
        value={mttr}
        elite="<1 hour"
        high="<1 day"
        medium="<1 week"
        low=">1 week"
      />
    </div>
  );
}

function ChangeFailureRateDetail({ 
  cfr, 
  releases, 
  failedReleases,
  blockers,
  alerts,
  onSourceClick
}: { 
  cfr: number; 
  releases: Event[];
  failedReleases: Event[];
  blockers: Event[];
  alerts: Event[];
} & DetailProps) {
  const rating = getCFRRating(cfr);
  const successfulReleases = releases.length - failedReleases.length;
  const allFailureEvents = [...failedReleases, ...blockers, ...alerts];

  const failureCategories = allFailureEvents.reduce((acc, event) => {
    const msg = event.message.toLowerCase();
    let category = "Other";
    if (msg.includes("bug") || msg.includes("error") || msg.includes("exception")) category = "Bugs";
    else if (msg.includes("rollback") || msg.includes("revert")) category = "Rollbacks";
    else if (msg.includes("outage") || msg.includes("down") || msg.includes("incident")) category = "Incidents";
    else if (msg.includes("fail") || msg.includes("broke") || msg.includes("broken")) category = "Build Failures";
    else if (msg.includes("test") || msg.includes("ci") || msg.includes("pipeline")) category = "Test Failures";
    else if (msg.includes("config") || msg.includes("setting") || msg.includes("environment")) category = "Config Issues";
    else if (msg.includes("gateway") || msg.includes("503") || msg.includes("timeout")) category = "Service Issues";
    
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const sortedCategories = Object.entries(failureCategories)
    .sort((a, b) => b[1] - a[1]);

  const categoryColors: Record<string, string> = {
    "Bugs": "bg-status-critical",
    "Rollbacks": "bg-risk-high",
    "Incidents": "bg-status-degraded",
    "Build Failures": "bg-primary",
    "Test Failures": "bg-primary",
    "Config Issues": "bg-primary",
    "Service Issues": "bg-primary",
    "Other": "bg-muted",
  };

  const rootCausePatterns = allFailureEvents.reduce((acc, event) => {
    const msg = event.message.toLowerCase();
    if (msg.includes("payment") || msg.includes("checkout")) {
      acc["Payment System"] = (acc["Payment System"] || 0) + 1;
    }
    if (msg.includes("database") || msg.includes("db") || msg.includes("connection")) {
      acc["Database"] = (acc["Database"] || 0) + 1;
    }
    if (msg.includes("memory") || msg.includes("cpu") || msg.includes("resource")) {
      acc["Resource Exhaustion"] = (acc["Resource Exhaustion"] || 0) + 1;
    }
    if (msg.includes("api") || msg.includes("gateway") || msg.includes("timeout")) {
      acc["API/Network"] = (acc["API/Network"] || 0) + 1;
    }
    if (msg.includes("deploy") || msg.includes("release") || msg.includes("version")) {
      acc["Deployment"] = (acc["Deployment"] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const sortedRootCauses = Object.entries(rootCausePatterns)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="space-y-4">
      <MetricSummaryCard
        icon={<AlertTriangle className="h-5 w-5" />}
        title="Change Failure Rate"
        value={`${(cfr * 100).toFixed(1)}%`}
        rating={rating}
        description="Percentage of deployments that result in degraded service"
      />

      <div className="grid grid-cols-4 gap-2">
        <Card className="p-3">
          <div className="text-xs text-muted-foreground mb-1">Deploys</div>
          <div className="text-xl font-bold">{releases.length}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground mb-1">Successful</div>
          <div className="text-xl font-bold text-status-healthy">{successfulReleases}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground mb-1">Failed</div>
          <div className="text-xl font-bold text-status-critical">{failedReleases.length}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground mb-1">Incidents</div>
          <div className="text-xl font-bold text-status-degraded">{blockers.length + alerts.length}</div>
        </Card>
      </div>

      <Separator />

      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Failure Categories
        </h4>
        <div className="space-y-2">
          {sortedCategories.map(([category, count]) => (
            <div key={category} className="flex items-center gap-3">
              <div className={cn("w-3 h-3 rounded-full", categoryColors[category] || "bg-gray-500")} />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{category}</span>
                  <span className="text-sm text-muted-foreground">{count}</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={cn("h-full rounded-full", categoryColors[category] || "bg-gray-500")}
                    style={{ width: `${(count / allFailureEvents.length) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {sortedRootCauses.length > 0 && (
        <>
          <Separator />
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Root Cause Analysis
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {sortedRootCauses.map(([cause, count]) => (
                <Card key={cause} className="p-3 border-status-critical/20 bg-status-critical/5">
                  <div className="text-xs text-muted-foreground mb-1">{cause}</div>
                  <div className="text-lg font-bold text-status-critical">{count} issues</div>
                </Card>
              ))}
            </div>
          </div>
        </>
      )}

      <Separator />

      <DataSources 
        events={allFailureEvents} 
        onSourceClick={onSourceClick}
        label="Failure Event Sources"
      />

      {failedReleases.length > 0 && (
        <>
          <Separator />
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Recent Failed Deployments
            </h4>
            <div className="space-y-2">
              {failedReleases.slice(0, 5).map((release) => (
                <Card key={release.id} className="p-3 border-status-critical/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-status-critical" />
                      <span className="text-sm">{release.message}</span>
                    </div>
                    <span className={cn("text-xs", sourceColors[release.source].split(' ')[0])}>
                      {sourceIcons[release.source]}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(release.timestamp), { addSuffix: true })}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </>
      )}

      <PerformanceBenchmark 
        metric="Change Failure Rate"
        value={cfr * 100}
        elite="<5%"
        high="5-10%"
        medium="10-15%"
        low=">15%"
      />
    </div>
  );
}

function MetricSummaryCard({ 
  icon, 
  title, 
  value, 
  rating, 
  description 
}: { 
  icon: React.ReactNode;
  title: string;
  value: string;
  rating: "elite" | "high" | "medium" | "low";
  description: string;
}) {
  const ratingColors = {
    elite: "text-status-healthy bg-status-healthy/10 border-status-healthy/30",
    high: "text-primary bg-primary/10 border-primary/30",
    medium: "text-status-degraded bg-status-degraded/10 border-status-degraded/30",
    low: "text-status-critical bg-status-critical/10 border-status-critical/30",
  };

  const ratingLabels = {
    elite: "Elite",
    high: "High",
    medium: "Medium",
    low: "Low",
  };

  return (
    <Card className={`p-4 border ${ratingColors[rating]}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="font-semibold">{title}</h3>
        </div>
        <Badge variant="outline" className={ratingColors[rating]}>
          {ratingLabels[rating]} Performer
        </Badge>
      </div>
      <div className="text-3xl font-bold mb-2">{value}</div>
      <p className="text-xs text-muted-foreground">{description}</p>
    </Card>
  );
}

function ReleaseCard({ event, onClick }: { event: Event; onClick?: () => void }) {
  const payload = event.payload as Record<string, unknown>;
  const failed = payload.failed === true;
  const leadTimeHours = payload.leadTimeHours as number | undefined;
  const isCircleCI = event.source === "circleci";
  const branch = payload.branch as string | undefined;
  
  // CircleCI URL construction
  const getCircleCIUrl = (): string | null => {
    const projectSlug = payload.projectSlug as string;
    const pipelineNumber = payload.pipelineNumber as number;
    
    if (!projectSlug || !pipelineNumber) return null;
    
    return `https://circleci.com/${projectSlug}/pipelines/${pipelineNumber}`;
  };
  
  const circleCIUrl = isCircleCI ? getCircleCIUrl() : null;

  return (
    <Card 
      className={cn("p-3 cursor-pointer transition-colors hover-elevate", failed ? "border-status-critical/30" : "")}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {failed ? (
            <XCircle className="h-4 w-4 text-status-critical flex-shrink-0" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-status-healthy flex-shrink-0" />
          )}
          <span className={cn("text-xs flex-shrink-0", sourceColors[event.source].split(' ')[0])}>
            {sourceIcons[event.source]}
          </span>
          <span className="text-sm truncate">{event.message}</span>
          {isCircleCI && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0 ml-2">
              {payload.pipelineNumber && (
                <Badge variant="outline" className="text-xs">
                  Pipeline #{payload.pipelineNumber}
                </Badge>
              )}
              {payload.workflowName && (
                <Badge variant="outline" className="text-xs">
                  {payload.workflowName as string}
                </Badge>
              )}
              {payload.jobName && (
                <Badge variant="outline" className="text-xs truncate max-w-[120px]">
                  {payload.jobName as string}
                </Badge>
              )}
              {branch && (
                <Badge variant="outline" className="text-xs">
                  {branch}
                </Badge>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {leadTimeHours !== undefined && (
            <Badge variant="outline" className="text-xs">
              {leadTimeHours}h
            </Badge>
          )}
          {circleCIUrl && (
            <a
              href={circleCIUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-muted-foreground hover:text-primary transition-colors"
              aria-label="Open in CircleCI"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
          </span>
        </div>
      </div>
    </Card>
  );
}

function PerformanceBenchmark({ 
  metric, 
  value,
  elite, 
  high, 
  medium, 
  low 
}: { 
  metric: string;
  value: number;
  elite: string;
  high: string;
  medium: string;
  low: string;
}) {
  return (
    <Card className="p-4 bg-muted/30">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        DORA Performance Benchmarks
      </h4>
      <div className="grid grid-cols-4 gap-2 text-xs">
        <div className="p-2 rounded bg-status-healthy/10 border border-status-healthy/30">
          <div className="font-semibold text-status-healthy mb-1">Elite</div>
          <div>{elite}</div>
        </div>
        <div className="p-2 rounded bg-primary/10 border border-primary/30">
          <div className="font-semibold text-primary mb-1">High</div>
          <div>{high}</div>
        </div>
        <div className="p-2 rounded bg-status-degraded/10 border border-status-degraded/30">
          <div className="font-semibold text-status-degraded mb-1">Medium</div>
          <div>{medium}</div>
        </div>
        <div className="p-2 rounded bg-status-critical/10 border border-status-critical/30">
          <div className="font-semibold text-status-critical mb-1">Low</div>
          <div>{low}</div>
        </div>
      </div>
    </Card>
  );
}

function getDeploymentRating(frequency: number): "elite" | "high" | "medium" | "low" {
  if (frequency >= 1) return "elite";
  if (frequency >= 1/7) return "high";
  if (frequency >= 1/30) return "medium";
  return "low";
}

function getLeadTimeRating(hours: number): "elite" | "high" | "medium" | "low" {
  if (hours < 1) return "elite";
  if (hours < 24) return "high";
  if (hours < 168) return "medium";
  return "low";
}

function getMTTRRating(hours: number): "elite" | "high" | "medium" | "low" {
  if (hours < 1) return "elite";
  if (hours < 24) return "high";
  if (hours < 168) return "medium";
  return "low";
}

function getCFRRating(rate: number): "elite" | "high" | "medium" | "low" {
  if (rate < 0.05) return "elite";
  if (rate < 0.10) return "high";
  if (rate < 0.15) return "medium";
  return "low";
}
