import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { EventDetailSheet } from "./event-detail-sheet";
import { UserProfileSheet } from "./user-profile-sheet";
import type { Event, EventSource } from "@shared/schema";
import { SiSlack, SiJira, SiGitlab, SiBitbucket, SiPagerduty } from "react-icons/si";
import { ChevronRight, Clock, ExternalLink } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface SourceBreakdownProps {
  events: Event[];
  className?: string;
}

const sourceConfig: Record<
  EventSource,
  { icon: React.ReactNode; label: string; color: string; bgColor: string; description: string }
> = {
  slack: {
    icon: <SiSlack className="h-4 w-4" />,
    label: "Slack",
    color: "text-primary",
    bgColor: "bg-primary",
    description: "Messages and updates from Slack channels",
  },
  jira: {
    icon: <SiJira className="h-4 w-4" />,
    label: "Jira",
    color: "text-primary",
    bgColor: "bg-primary",
    description: "Issues and tickets from Jira projects",
  },
  gitlab: {
    icon: <SiGitlab className="h-4 w-4" />,
    label: "GitLab",
    color: "text-primary",
    bgColor: "bg-primary",
    description: "Merge requests and pipeline events from GitLab",
  },
  bitbucket: {
    icon: <SiBitbucket className="h-4 w-4" />,
    label: "Bitbucket",
    color: "text-primary",
    bgColor: "bg-primary",
    description: "Pull requests and commits from Bitbucket",
  },
  pagerduty: {
    icon: <SiPagerduty className="h-4 w-4" />,
    label: "PagerDuty",
    color: "text-status-critical",
    bgColor: "bg-status-critical",
    description: "Incidents and alerts from PagerDuty",
  },
};

const severityBadgeVariants: Record<string, "destructive" | "default" | "secondary" | "outline"> = {
  critical: "destructive",
  high: "destructive",
  medium: "default",
  low: "secondary",
};

export function SourceBreakdown({ events, className }: SourceBreakdownProps) {
  const [selectedSource, setSelectedSource] = useState<EventSource | null>(null);
  const [sourceDetailOpen, setSourceDetailOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [eventDetailOpen, setEventDetailOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [userProfileOpen, setUserProfileOpen] = useState(false);

  const breakdown = useMemo(() => {
    const counts: Record<EventSource, number> = {
      slack: 0,
      jira: 0,
      gitlab: 0,
      bitbucket: 0,
      pagerduty: 0,
    };

    events.forEach((event) => {
      counts[event.source]++;
    });

    const total = events.length || 1;

    return (Object.keys(counts) as EventSource[]).map((source) => ({
      source,
      count: counts[source],
      percentage: (counts[source] / total) * 100,
      ...sourceConfig[source],
    }));
  }, [events]);

  const total = events.length;

  const handleSourceClick = (source: EventSource) => {
    setSelectedSource(source);
    setSourceDetailOpen(true);
  };

  const handleEventClick = (event: Event) => {
    setSelectedEvent(event);
    setEventDetailOpen(true);
  };

  const handleUserClick = (username: string) => {
    setSelectedUser(username);
    setUserProfileOpen(true);
  };

  const filteredEvents = selectedSource 
    ? events.filter(e => e.source === selectedSource)
    : [];

  return (
    <>
      <Card
        className={cn("p-4 font-mono border border-border bg-card", className)}
        data-testid="source-breakdown"
      >
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-semibold">Source Breakdown</span>
          <span className="text-xs text-muted-foreground">{total} total events</span>
        </div>

        <div className="h-3 flex rounded-full overflow-hidden bg-muted mb-4">
          {breakdown.map((item) =>
            item.count > 0 ? (
              <button
                key={item.source}
                className={cn("h-full transition-all cursor-pointer hover:opacity-80", item.bgColor)}
                style={{ width: `${item.percentage}%` }}
                title={`${item.label}: ${item.count} - Click to view`}
                onClick={() => handleSourceClick(item.source)}
                data-testid={`source-bar-${item.source}`}
              />
            ) : null
          )}
        </div>

        <div className="space-y-1">
          {breakdown.map((item) => (
            <button
              key={item.source}
              className="group w-full flex items-center justify-between text-sm p-2 rounded-md hover-elevate cursor-pointer"
              onClick={() => handleSourceClick(item.source)}
              data-testid={`source-${item.source}`}
            >
              <div className={cn("flex items-center gap-2", item.color)}>
                {item.icon}
                <span>{item.label}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground">{item.count}</span>
                <span className="w-12 text-right">{item.percentage.toFixed(0)}%</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </button>
          ))}
        </div>
      </Card>

      <SourceDetailSheet
        open={sourceDetailOpen}
        onOpenChange={setSourceDetailOpen}
        source={selectedSource}
        events={filteredEvents}
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

interface SourceDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: EventSource | null;
  events: Event[];
  onEventClick: (event: Event) => void;
}

function SourceDetailSheet({ open, onOpenChange, source, events, onEventClick }: SourceDetailSheetProps) {
  if (!source) return null;
  
  const config = sourceConfig[source];
  const unresolvedCount = events.filter(e => !e.resolved).length;
  const criticalCount = events.filter(e => e.severity === "critical" && !e.resolved).length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl font-mono overflow-y-auto" data-testid="source-detail-sheet">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <div className={config.color}>{config.icon}</div>
            {config.label} Events
          </SheetTitle>
          <SheetDescription>
            {config.description}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {events.length} Events
            </span>
            <div className="flex items-center gap-2">
              {criticalCount > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {criticalCount} Critical
                </Badge>
              )}
              {unresolvedCount > 0 && (
                <Badge variant="outline" className="text-xs">
                  {unresolvedCount} Open
                </Badge>
              )}
            </div>
          </div>

          {events.length === 0 ? (
            <Card className="p-6 text-center">
              <p className="text-muted-foreground">No events from {config.label}</p>
            </Card>
          ) : (
            <ScrollArea className="h-[calc(100vh-220px)]">
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
  return (
    <div
      className="group rounded-md border border-border bg-card/50 p-3 transition-all cursor-pointer hover-elevate"
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
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={severityBadgeVariants[event.severity]} className="text-xs">
              {event.severity.toUpperCase()}
            </Badge>
            <Badge variant="outline" className="text-xs capitalize">
              {event.type}
            </Badge>
            {event.resolved && (
              <Badge variant="outline" className="text-xs text-emerald-400 border-emerald-400/50">
                Resolved
              </Badge>
            )}
          </div>
          
          <p className="mt-2 text-sm">{event.message}</p>
          
          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}</span>
            {event.username && (
              <>
                <span>by</span>
                <span className="font-medium text-primary">@{event.username}</span>
              </>
            )}
          </div>

          {event.externalLink && (
            <a
              href={event.externalLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-xs text-blue-400 hover:text-blue-300 hover:underline"
              onClick={(e) => e.stopPropagation()}
              data-testid={`source-event-link-${event.id}`}
            >
              <ExternalLink className="h-3 w-3" />
              <span>Open in {sourceConfig[event.source].label}</span>
            </a>
          )}
        </div>

        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      </div>
    </div>
  );
}
