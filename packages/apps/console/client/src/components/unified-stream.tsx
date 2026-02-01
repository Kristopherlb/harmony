import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import type { Event, EventSource, EventType } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Card } from "@/components/ui/card";
import { StatusIndicator } from "./status-indicator";
import { EventDetailSheet } from "./event-detail-sheet";
import { UserProfileSheet } from "./user-profile-sheet";
import {
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  GitBranch,
  Bell,
  FileText,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Clock,
  Wrench,
} from "lucide-react";
import { UserActionMenu } from "./user-action-menu";
import { SiSlack, SiJira, SiGitlab, SiBitbucket, SiPagerduty } from "react-icons/si";
import { Link } from "wouter";

interface UnifiedStreamProps {
  events: Event[];
  className?: string;
  maxHeight?: string;
}

const sourceIcons: Record<EventSource, React.ReactNode> = {
  slack: <SiSlack className="h-4 w-4" />,
  jira: <SiJira className="h-4 w-4" />,
  gitlab: <SiGitlab className="h-4 w-4" />,
  bitbucket: <SiBitbucket className="h-4 w-4" />,
  pagerduty: <SiPagerduty className="h-4 w-4" />,
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

const typeIcons: Record<EventType, React.ReactNode> = {
  log: <MessageSquare className="h-3.5 w-3.5" />,
  blocker: <AlertTriangle className="h-3.5 w-3.5" />,
  decision: <FileText className="h-3.5 w-3.5" />,
  release: <GitBranch className="h-3.5 w-3.5" />,
  alert: <Bell className="h-3.5 w-3.5" />,
};

const typeLabels: Record<EventType, string> = {
  log: "Log",
  blocker: "Blocker",
  decision: "Decision",
  release: "Release",
  alert: "Alert",
};

const typeBadgeVariants: Record<EventType, "default" | "secondary" | "destructive" | "outline"> = {
  log: "secondary",
  blocker: "destructive",
  decision: "default",
  release: "default",
  alert: "destructive",
};

const severityBadgeVariants: Record<string, "destructive" | "default" | "secondary" | "outline"> = {
  critical: "destructive",
  high: "destructive",
  medium: "default",
  low: "secondary",
};

export function UnifiedStream({
  events,
  className,
  maxHeight = "500px",
}: UnifiedStreamProps) {
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [userProfileOpen, setUserProfileOpen] = useState(false);
  const [selectedSource, setSelectedSource] = useState<EventSource | null>(null);
  const [sourceDetailOpen, setSourceDetailOpen] = useState(false);

  const sortedEvents = [...events].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const handleEventClick = (event: Event) => {
    setSelectedEvent(event);
    setSheetOpen(true);
  };

  const handleUserClick = (username: string) => {
    setSelectedUser(username);
    setUserProfileOpen(true);
  };

  const handleSourceClick = (source: EventSource) => {
    setSelectedSource(source);
    setSourceDetailOpen(true);
  };

  const filteredSourceEvents = selectedSource 
    ? events.filter(e => e.source === selectedSource)
    : [];

  return (
    <>
      <ScrollArea className={cn("w-full", className)} style={{ maxHeight }}>
        <div className="space-y-2 pr-4" data-testid="unified-stream">
          {sortedEvents.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground font-mono">
              No events to display
            </div>
          ) : (
            sortedEvents.map((event) => (
              <EventCard 
                key={event.id} 
                event={event} 
                onClick={() => handleEventClick(event)}
                onUserClick={handleUserClick}
                onSourceClick={handleSourceClick}
              />
            ))
          )}
        </div>
      </ScrollArea>

      <EventDetailSheet
        event={selectedEvent}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onUserClick={handleUserClick}
      />

      <UserProfileSheet
        username={selectedUser}
        open={userProfileOpen}
        onOpenChange={setUserProfileOpen}
        onEventClick={handleEventClick}
        onSourceClick={handleSourceClick}
      />

      <SourceFilterSheet
        open={sourceDetailOpen}
        onOpenChange={setSourceDetailOpen}
        source={selectedSource}
        events={filteredSourceEvents}
        onEventClick={handleEventClick}
      />
    </>
  );
}

interface EventCardProps {
  event: Event;
  onClick: () => void;
  onUserClick: (username: string) => void;
  onSourceClick: (source: EventSource) => void;
}

function EventCard({ event, onClick, onUserClick, onSourceClick }: EventCardProps) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const timeAgo = formatDistanceToNow(new Date(event.timestamp), { addSuffix: true });

  const isIncident = event.source === "pagerduty" && (event.type === "alert" || event.type === "blocker");

  return (
    <div
      className={cn(
        "group relative rounded-md border border-border bg-card p-3 sm:p-3 font-mono transition-all cursor-pointer hover-elevate touch-manipulation min-h-[60px]",
        event.severity === "critical" && !event.resolved && "border-red-500/50 glow-red"
      )}
      data-testid={`event-card-${event.id}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div className="flex items-start gap-3">
        <button
          className={cn(
            "mt-0.5 p-1.5 rounded-md border border-border hover-elevate cursor-pointer shrink-0",
            sourceColors[event.source]
          )}
          onClick={(e) => {
            e.stopPropagation();
            onSourceClick(event.source);
          }}
          title={`View all ${sourceLabels[event.source]} events`}
          data-testid={`event-source-${event.id}`}
        >
          {sourceIcons[event.source]}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusIndicator severity={event.severity} size="sm" pulse={event.severity === "critical" && !event.resolved} />
            <Badge variant={typeBadgeVariants[event.type]} className="gap-1 font-mono text-xs">
              {typeIcons[event.type]}
              {typeLabels[event.type]}
            </Badge>
            {event.username && (
              <UserActionMenu
                username={event.username}
                open={userMenuOpen}
                onOpenChange={setUserMenuOpen}
                onViewProfile={() => onUserClick(event.username!)}
                trigger={
                  <button
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                    onClick={(e) => e.stopPropagation()}
                    data-testid={`button-username-${event.id}`}
                  >
                    @{event.username}
                    <ChevronDown className="h-3 w-3 opacity-50" />
                  </button>
                }
              />
            )}
            {event.externalLink && (
              <a
                href={event.externalLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 hover:underline"
                onClick={(e) => e.stopPropagation()}
                data-testid={`link-event-${event.id}`}
              >
                <ExternalLink className="h-3 w-3" />
                <span>View</span>
              </a>
            )}
            {isIncident && !event.resolved && (
              <Link
                href="/operations"
                className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 hover:underline"
                onClick={(e) => e.stopPropagation()}
                data-testid={`link-ops-${event.id}`}
              >
                <Wrench className="h-3 w-3" />
                <span>Ops Hub</span>
              </Link>
            )}
            <span className="text-xs text-muted-foreground ml-auto">{timeAgo}</span>
          </div>

          <p className="mt-2 text-sm leading-relaxed break-words">{event.message}</p>

          {event.resolved && (
            <div className="flex items-center gap-1.5 mt-2 text-xs text-emerald-500">
              <CheckCircle2 className="h-3 w-3" />
              <span>Resolved</span>
            </div>
          )}
        </div>

        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      </div>
    </div>
  );
}

interface SourceFilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: EventSource | null;
  events: Event[];
  onEventClick: (event: Event) => void;
}

function SourceFilterSheet({ open, onOpenChange, source, events, onEventClick }: SourceFilterSheetProps) {
  if (!source) return null;

  const unresolvedCount = events.filter(e => !e.resolved).length;
  const criticalCount = events.filter(e => e.severity === "critical" && !e.resolved).length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl font-mono overflow-y-auto" data-testid="source-filter-sheet">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <div className={sourceColors[source]}>{sourceIcons[source]}</div>
            {sourceLabels[source]} Events
          </SheetTitle>
          <SheetDescription>
            All events from {sourceLabels[source]}
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

          {source === "pagerduty" && unresolvedCount > 0 && (
            <Card className="p-3 border-amber-500/30 bg-amber-500/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-400">
                  <Wrench className="h-4 w-4" />
                  <span className="text-sm font-medium">Incident Response</span>
                </div>
                <Link
                  href="/operations"
                  className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300"
                  data-testid="link-ops-hub"
                >
                  <span>Go to Operations Hub</span>
                  <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Use runbooks and remediation actions to resolve incidents
              </p>
            </Card>
          )}

          {events.length === 0 ? (
            <Card className="p-6 text-center">
              <p className="text-muted-foreground">No events from {sourceLabels[source]}</p>
            </Card>
          ) : (
            <ScrollArea className="h-[calc(100vh-280px)]">
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

function SourceEventCard({ event, onClick }: { event: Event; onClick: () => void }) {
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
      data-testid={`source-filter-event-${event.id}`}
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
            >
              <ExternalLink className="h-3 w-3" />
              <span>Open in {sourceLabels[event.source]}</span>
            </a>
          )}
        </div>

        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      </div>
    </div>
  );
}
