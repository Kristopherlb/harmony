import { useState } from "react";
import { formatDistanceToNow, format } from "date-fns";
import type { UserProfile, Event, EventSource } from "@shared/schema";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatusIndicator } from "./status-indicator";
import { EventDetailSheet } from "./event-detail-sheet";
import {
  User,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Activity,
  MessageSquare,
  Briefcase,
  GitPullRequest,
  Bug,
  Bell,
  Timer,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { SiSlack, SiJira, SiGitlab, SiBitbucket, SiPagerduty } from "react-icons/si";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

type ActivityStatType = "logs" | "resolved" | "decisions" | "total";

interface UserProfileSheetProps {
  username: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEventClick?: (event: Event) => void;
  onWorkloadItemClick?: (type: "blockers" | "prs" | "tickets" | "alerts", username: string) => void;
  onSourceClick?: (source: EventSource) => void;
}

const sourceIcons: Record<EventSource, React.ReactNode> = {
  slack: <SiSlack className="h-3 w-3" />,
  jira: <SiJira className="h-3 w-3" />,
  gitlab: <SiGitlab className="h-3 w-3" />,
  bitbucket: <SiBitbucket className="h-3 w-3" />,
  pagerduty: <SiPagerduty className="h-3 w-3" />,
};

const sourceColors: Record<EventSource, string> = {
  slack: "text-primary",
  jira: "text-primary",
  gitlab: "text-primary",
  bitbucket: "text-primary",
  pagerduty: "text-status-critical",
};

const sourceLabels: Record<EventSource, string> = {
  slack: "Slack",
  jira: "Jira",
  gitlab: "GitLab",
  bitbucket: "Bitbucket",
  pagerduty: "PagerDuty",
};

export function UserProfileSheet({ username, open, onOpenChange, onEventClick, onWorkloadItemClick, onSourceClick }: UserProfileSheetProps) {
  const [activityStatType, setActivityStatType] = useState<ActivityStatType | null>(null);
  const [activityDetailOpen, setActivityDetailOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [eventDetailOpen, setEventDetailOpen] = useState(false);

  const { data: profile, isLoading } = useQuery<UserProfile>({
    queryKey: ['/api/users', username, 'profile'],
    enabled: !!username && open,
  });

  // Internal handlers that work even when props aren't provided
  const handleEventClick = (event: Event) => {
    if (onEventClick) {
      onEventClick(event);
    } else {
      setSelectedEvent(event);
      setEventDetailOpen(true);
    }
  };

  const [workloadFilterType, setWorkloadFilterType] = useState<"blockers" | "prs" | "tickets" | "alerts" | null>(null);

  const handleWorkloadItemClick = (type: "blockers" | "prs" | "tickets" | "alerts") => {
    if (onWorkloadItemClick && username) {
      onWorkloadItemClick(type, username);
    } else {
      // Default behavior: filter by type and show in activity detail
      setWorkloadFilterType(type);
      setActivityStatType("total"); // Use total to show all events, then filter by workload type
      setActivityDetailOpen(true);
    }
  };

  const handleActivityStatClick = (type: ActivityStatType) => {
    setActivityStatType(type);
    setActivityDetailOpen(true);
  };

  const getFilteredActivityEvents = (): Event[] => {
    if (!profile) return [];
    const allEvents = [...profile.recentEvents, ...profile.assignedItems];
    const uniqueEvents = allEvents.filter((e, i, arr) => arr.findIndex(x => x.id === e.id) === i);
    
    switch (activityStatType) {
      case "logs":
        return uniqueEvents.filter(e => e.type === "log");
      case "resolved":
        return uniqueEvents.filter(e => e.resolved);
      case "decisions":
        return uniqueEvents.filter(e => e.type === "decision");
      case "total":
        return uniqueEvents;
      default:
        return [];
    }
  };

  // Get filtered events for workload items
  const getWorkloadFilteredEvents = (type: "blockers" | "prs" | "tickets" | "alerts"): Event[] => {
    if (!profile) return [];
    const allEvents = [...profile.recentEvents, ...profile.assignedItems];
    const uniqueEvents = allEvents.filter((e, i, arr) => arr.findIndex(x => x.id === e.id) === i);
    
    switch (type) {
      case "blockers":
        return uniqueEvents.filter(e => e.type === "blocker" && !e.resolved);
      case "prs":
        // PRs might be in payload or message - filter by type or message content
        return uniqueEvents.filter(e => 
          e.type === "log" && (e.message.toLowerCase().includes("pr") || e.message.toLowerCase().includes("pull request"))
        );
      case "tickets":
        // Tickets might be in payload or message - filter by source or message
        return uniqueEvents.filter(e => 
          e.source === "jira" || e.message.toLowerCase().includes("ticket")
        );
      case "alerts":
        return uniqueEvents.filter(e => e.type === "alert" && !e.resolved);
      default:
        return [];
    }
  };

  const getActivityStatConfig = () => {
    switch (activityStatType) {
      case "logs":
        return { 
          title: "Activity Logs", 
          description: "All logged activity",
          icon: <FileText className="h-5 w-5 text-primary" />,
          emptyMessage: "No logs recorded"
        };
      case "resolved":
        return { 
          title: "Resolved Items", 
          description: "Items that have been resolved",
          icon: <CheckCircle2 className="h-5 w-5 text-status-healthy" />,
          emptyMessage: "No resolved items"
        };
      case "decisions":
        return { 
          title: "Decisions Made", 
          description: "Architectural decisions logged",
          icon: <MessageSquare className="h-5 w-5 text-primary" />,
          emptyMessage: "No decisions recorded"
        };
      case "total":
        return { 
          title: "All Events", 
          description: "All activity events",
          icon: <Briefcase className="h-5 w-5 text-primary" />,
          emptyMessage: "No events found"
        };
      default:
        return { 
          title: "", 
          description: "",
          icon: null,
          emptyMessage: "No items to display"
        };
    }
  };

  if (!username) return null;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg font-mono overflow-y-auto" data-testid="user-profile-sheet">
          <SheetHeader className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14 border-2 border-primary/20">
                <AvatarFallback className="text-lg font-bold bg-primary/10">
                  {username.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <SheetTitle className="text-lg font-semibold">
                  @{username}
                </SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground mt-1">
                  Engineering Team Member
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <ScrollArea className="mt-6 h-[calc(100vh-160px)]">
            <div className="space-y-6 pr-4">
              {isLoading ? (
                <Card className="p-6 text-center text-muted-foreground">
                  Loading profile...
                </Card>
              ) : profile ? (
                <>
                  <WorkloadMetrics 
                    stats={profile.stats} 
                    onItemClick={handleWorkloadItemClick}
                  />
                  <Separator />
                  <WorkloadStats 
                    stats={profile.stats}
                    onStatClick={handleActivityStatClick}
                  />
                  <Separator />
                  <AssignedItems 
                    items={profile.assignedItems} 
                    onEventClick={handleEventClick}
                    onSourceClick={onSourceClick}
                  />
                  <Separator />
                  <RecentActivity 
                    events={profile.recentEvents}
                    onEventClick={handleEventClick}
                    onSourceClick={onSourceClick}
                  />
                </>
              ) : (
                <Card className="p-6 text-center text-muted-foreground">
                  No profile data found for @{username}
                </Card>
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <ActivityStatDetailSheet
        open={activityDetailOpen}
        onOpenChange={(open) => {
          setActivityDetailOpen(open);
          if (!open) {
            setWorkloadFilterType(null);
            setActivityStatType(null);
          }
        }}
        events={workloadFilterType ? getWorkloadFilteredEvents(workloadFilterType) : getFilteredActivityEvents()}
        config={workloadFilterType ? {
          title: workloadFilterType === "blockers" ? "Open Blockers" : 
                 workloadFilterType === "prs" ? "Open PRs" :
                 workloadFilterType === "tickets" ? "Open Tickets" :
                 "Active Alerts",
          description: `Items from ${workloadFilterType}`,
          icon: workloadFilterType === "blockers" ? <AlertTriangle className="h-5 w-5 text-status-critical" /> :
                workloadFilterType === "prs" ? <GitPullRequest className="h-5 w-5 text-primary" /> :
                workloadFilterType === "tickets" ? <Bug className="h-5 w-5 text-primary" /> :
                <Bell className="h-5 w-5 text-status-degraded" />,
          emptyMessage: `No ${workloadFilterType} found`,
        } : getActivityStatConfig()}
        onEventClick={handleEventClick}
      />

      <EventDetailSheet
        event={selectedEvent}
        open={eventDetailOpen}
        onOpenChange={setEventDetailOpen}
        onUserClick={(username) => {
          // Could open another profile sheet, but for now just close
          setEventDetailOpen(false);
        }}
      />
    </>
  );
}

function WorkloadMetrics({ stats, onItemClick }: { 
  stats: UserProfile["stats"]; 
  onItemClick?: (type: "blockers" | "prs" | "tickets" | "alerts") => void;
}) {
  const metrics = [
    { 
      type: "blockers" as const,
      label: "Open Blockers", 
      value: stats.openBlockers, 
      icon: AlertTriangle, 
      color: "text-status-critical",
      bgColor: "bg-status-critical/10",
      urgent: stats.openBlockers > 0,
    },
    { 
      type: "prs" as const,
      label: "Open PRs", 
      value: stats.openPRs, 
      icon: GitPullRequest, 
      color: "text-primary",
      bgColor: "bg-primary/10",
      urgent: stats.openPRs > 5,
    },
    { 
      type: "tickets" as const,
      label: "Open Tickets", 
      value: stats.openTickets, 
      icon: Bug, 
      color: "text-primary",
      bgColor: "bg-primary/10",
      urgent: stats.openTickets > 10,
    },
    { 
      type: "alerts" as const,
      label: "Active Alerts", 
      value: stats.openAlerts, 
      icon: Bell, 
      color: "text-status-degraded",
      bgColor: "bg-status-degraded/10",
      urgent: stats.openAlerts > 0,
    },
  ];

  return (
    <div className="space-y-4">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
        <Briefcase className="h-3 w-3" />
        Current Workload
      </h4>
      <div className="grid grid-cols-2 gap-3">
        {metrics.map((metric) => (
          <button
            key={metric.type}
            className={`group p-3 rounded-lg border border-border ${metric.bgColor} hover-elevate cursor-pointer text-left`}
            onClick={() => onItemClick?.(metric.type)}
            data-testid={`workload-${metric.type}`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <metric.icon className={`h-4 w-4 ${metric.color}`} />
                <span className="text-xs text-muted-foreground">{metric.label}</span>
              </div>
              <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-2xl font-bold ${metric.value > 0 ? metric.color : "text-muted-foreground"}`}>
                {metric.value}
              </span>
              {metric.urgent && metric.value > 0 && (
                <Badge variant="destructive" className="text-[10px] px-1.5">
                  Needs Attention
                </Badge>
              )}
            </div>
          </button>
        ))}
      </div>
      {stats.avgResponseTime !== undefined && (
        <Card className="p-3 mt-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Timer className="h-3 w-3" />
            <span>Avg Response Time</span>
          </div>
          <div className="text-lg font-bold text-status-healthy">
            {stats.avgResponseTime}h
          </div>
        </Card>
      )}
    </div>
  );
}

function WorkloadStats({ stats, onStatClick }: { 
  stats: UserProfile["stats"];
  onStatClick?: (type: ActivityStatType) => void;
}) {
  const statItems = [
    {
      type: "logs" as const,
      label: "Logs This Week",
      value: stats.logsThisWeek,
      icon: FileText,
      color: "text-primary",
    },
    {
      type: "resolved" as const,
      label: "Blockers Resolved",
      value: stats.blockersResolved,
      icon: CheckCircle2,
      color: "text-status-healthy",
    },
    {
      type: "decisions" as const,
      label: "Decisions Made",
      value: stats.decisionsLogged,
      icon: MessageSquare,
      color: "text-primary",
    },
    {
      type: "total" as const,
      label: "Total Events",
      value: stats.totalEvents,
      icon: Briefcase,
      color: "text-foreground",
    },
  ];

  return (
    <div className="space-y-4">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
        <Activity className="h-3 w-3" />
        Activity Summary
      </h4>
      <div className="grid grid-cols-2 gap-3">
        {statItems.map((item) => (
          <button
            key={item.type}
            className="group p-3 rounded-lg border border-border bg-card hover-elevate cursor-pointer text-left"
            onClick={() => onStatClick?.(item.type)}
            data-testid={`activity-stat-${item.type}`}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <item.icon className="h-3 w-3" />
                <span>{item.label}</span>
              </div>
              <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className={cn("text-2xl font-bold", item.color)}>
              {item.value}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function AssignedItems({ items, onEventClick, onSourceClick }: { 
  items: Event[]; 
  onEventClick?: (event: Event) => void;
  onSourceClick?: (source: EventSource) => void;
}) {
  const openItems = items.filter(i => !i.resolved);
  
  return (
    <div className="space-y-4">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
        <AlertTriangle className="h-3 w-3" />
        Open Assignments ({openItems.length})
      </h4>
      <div className="space-y-2">
        {openItems.length === 0 ? (
          <Card className="p-4 text-center text-muted-foreground text-sm">
            No open assignments
          </Card>
        ) : (
          openItems.slice(0, 5).map((item) => (
            <Card 
              key={item.id} 
              className="p-3 hover-elevate cursor-pointer transition-all"
              onClick={() => onEventClick?.(item)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onEventClick?.(item);
                }
              }}
              role="button"
              tabIndex={0}
              data-testid={`assigned-item-${item.id}`}
            >
              <div className="flex items-start gap-3">
                <button
                  className={cn(
                    "p-1.5 rounded-md border border-border hover-elevate cursor-pointer shrink-0",
                    sourceColors[item.source]
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSourceClick?.(item.source);
                  }}
                  title={`View all ${sourceLabels[item.source]} events`}
                  data-testid={`assigned-source-${item.id}`}
                >
                  {sourceIcons[item.source]}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{item.message}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <StatusIndicator severity={item.severity} size="sm" />
                    <span className="text-xs text-muted-foreground capitalize">{item.severity}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                    </span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function RecentActivity({ events, onEventClick, onSourceClick }: { 
  events: Event[]; 
  onEventClick?: (event: Event) => void;
  onSourceClick?: (source: EventSource) => void;
}) {
  return (
    <div className="space-y-4">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
        <Clock className="h-3 w-3" />
        Recent Activity
      </h4>
      <div className="space-y-2">
        {events.length === 0 ? (
          <Card className="p-4 text-center text-muted-foreground text-sm">
            No recent activity
          </Card>
        ) : (
          events.slice(0, 8).map((event) => (
            <Card 
              key={event.id} 
              className="p-3 hover-elevate cursor-pointer transition-all"
              onClick={() => onEventClick?.(event)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onEventClick?.(event);
                }
              }}
              role="button"
              tabIndex={0}
              data-testid={`recent-activity-${event.id}`}
            >
              <div className="flex items-center gap-3">
                <button
                  className={cn(
                    "p-1.5 rounded-md border border-border hover-elevate cursor-pointer shrink-0",
                    sourceColors[event.source]
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSourceClick?.(event.source);
                  }}
                  title={`View all ${sourceLabels[event.source]} events`}
                  data-testid={`activity-source-${event.id}`}
                >
                  {sourceIcons[event.source]}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{event.message}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(event.timestamp), "MMM d, HH:mm")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {event.type}
                  </Badge>
                  {event.resolved && (
                    <CheckCircle2 className="h-3 w-3 text-status-healthy" />
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

interface ActivityStatDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  events: Event[];
  config: { title: string; description?: string; icon: React.ReactNode; emptyMessage?: string };
  onEventClick?: (event: Event) => void;
}

function ActivityStatDetailSheet({ open, onOpenChange, events, config, onEventClick }: ActivityStatDetailSheetProps) {
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [eventDetailOpen, setEventDetailOpen] = useState(false);

  const handleEventClick = (event: Event) => {
    // Always open event detail sheet (self-contained behavior)
    // This ensures the component works in any context
    setSelectedEvent(event);
    setEventDetailOpen(true);
    
    // Also call optional custom handler if provided (for parent coordination)
    onEventClick?.(event);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-xl font-mono overflow-y-auto" data-testid="activity-stat-detail">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {config.icon}
              {config.title}
            </SheetTitle>
            <SheetDescription>
              {config.description || `${events.length} items`}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6">
            {events.length === 0 ? (
              <Card className="p-6 text-center">
                <p className="text-muted-foreground">{config.emptyMessage || "No items to display"}</p>
              </Card>
            ) : (
              <ScrollArea className="h-[calc(100vh-200px)]">
                <div className="space-y-2 pr-4">
                  {events.map((event) => (
                    <ActivityEventCard 
                      key={event.id} 
                      event={event} 
                      onClick={() => handleEventClick(event)}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <EventDetailSheet
        event={selectedEvent}
        open={eventDetailOpen}
        onOpenChange={setEventDetailOpen}
        onUserClick={(username) => {
          // Could open another profile sheet, but for now just close
          setEventDetailOpen(false);
        }}
      />
    </>
  );
}

function ActivityEventCard({ event, onClick }: { event: Event; onClick: () => void }) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onClick();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    }
  };

  return (
    <div
      className="group rounded-md border border-border bg-card/50 p-3 transition-all cursor-pointer hover-elevate active:scale-[0.98]"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      data-testid={`activity-event-${event.id}`}
    >
      <div className="flex items-start gap-3">
        <div className={sourceColors[event.source]}>
          {sourceIcons[event.source]}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm">{event.message}</p>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}</span>
            <Badge variant="outline" className="text-xs capitalize">
              {event.type}
            </Badge>
            {event.resolved && (
              <Badge variant="outline" className="text-xs text-status-healthy border-status-healthy/50">
                Resolved
              </Badge>
            )}
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      </div>
    </div>
  );
}
