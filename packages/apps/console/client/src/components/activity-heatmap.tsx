import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { Event, EventSource } from "@shared/schema";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
import { EventDetailSheet } from "./event-detail-sheet";
import { UserProfileSheet } from "./user-profile-sheet";
import { format } from "date-fns";
import { Clock, ChevronRight, ExternalLink, Calendar } from "lucide-react";
import { SiSlack, SiJira, SiGitlab, SiBitbucket, SiPagerduty } from "react-icons/si";

interface ActivityHeatmapProps {
  events: Event[];
  weeks?: number; // Deprecated - kept for backward compatibility
  className?: string;
}

const sourceColors: Record<EventSource, string> = {
  slack: "bg-blue-500 hover:bg-blue-600",
  jira: "bg-blue-400 hover:bg-blue-500",
  gitlab: "bg-purple-500 hover:bg-purple-600",
  bitbucket: "bg-blue-600 hover:bg-blue-700",
  pagerduty: "bg-red-500 hover:bg-red-600",
} as const;

const sourceTextColors: Record<EventSource, string> = {
  slack: "text-primary",
  jira: "text-primary",
  gitlab: "text-primary",
  bitbucket: "text-primary",
  pagerduty: "text-status-critical",
};

const sourceIcons: Record<EventSource, React.ReactNode> = {
  slack: <SiSlack className="h-3 w-3" />,
  jira: <SiJira className="h-3 w-3" />,
  gitlab: <SiGitlab className="h-3 w-3" />,
  bitbucket: <SiBitbucket className="h-3 w-3" />,
  pagerduty: <SiPagerduty className="h-3 w-3" />,
};

const sourceLabels = {
  slack: "Slack",
  jira: "Jira",
  gitlab: "GitLab",
  bitbucket: "Bitbucket",
  pagerduty: "PagerDuty",
} as const;

const severityBadgeVariants: Record<string, "destructive" | "default" | "secondary" | "outline"> = {
  critical: "destructive",
  high: "destructive",
  medium: "default",
  low: "secondary",
};

/**
 * Converts a Date to a local YYYY-MM-DD string.
 * Uses local timezone instead of UTC to ensure accurate date matching.
 */
export function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

interface DayData {
  date: string;
  count: number;
  dominantSource: EventSource | null;
  sources: Record<EventSource, number>;
  events: Event[];
}

export function ActivityHeatmap({ events, weeks = 12, className }: ActivityHeatmapProps) {
  const [selectedDay, setSelectedDay] = useState<DayData | null>(null);
  const [dayDetailOpen, setDayDetailOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [eventDetailOpen, setEventDetailOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [userProfileOpen, setUserProfileOpen] = useState(false);

  const heatmapData = useMemo(() => {
    const today = new Date();
    const days: DayData[] = [];
    const eventsByDate: Record<string, Event[]> = {};

    // Group events by local date (not UTC)
    events.forEach((event) => {
      const eventDate = new Date(event.timestamp);
      const localDateStr = getLocalDateString(eventDate);
      if (!eventsByDate[localDateStr]) {
        eventsByDate[localDateStr] = [];
      }
      eventsByDate[localDateStr].push(event);
    });

    // Get the first day of the current month
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    firstDayOfMonth.setHours(0, 0, 0, 0);

    // Get the last day of the current month
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    lastDayOfMonth.setHours(23, 59, 59, 999);

    // Generate days for the entire current month
    const currentDate = new Date(firstDayOfMonth);
    while (currentDate <= lastDayOfMonth) {
      const dateStr = getLocalDateString(currentDate);
      const dayEvents = eventsByDate[dateStr] || [];

      const sources: Record<EventSource, number> = {
        slack: 0,
        jira: 0,
        gitlab: 0,
        bitbucket: 0,
        pagerduty: 0,
      };

      dayEvents.forEach((e) => {
        sources[e.source]++;
      });

      let dominantSource: EventSource | null = null;
      let maxCount = 0;
      (Object.keys(sources) as EventSource[]).forEach((src) => {
        if (sources[src] > maxCount) {
          maxCount = sources[src];
          dominantSource = src;
        }
      });

      days.push({
        date: dateStr,
        count: dayEvents.length,
        dominantSource,
        sources,
        events: dayEvents,
      });

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return days;
  }, [events]);

  const handleDayClick = (day: DayData) => {
    if (day.count > 0) {
      setSelectedDay(day);
      setDayDetailOpen(true);
    }
  };

  const handleEventClick = (event: Event) => {
    setSelectedEvent(event);
    setEventDetailOpen(true);
  };

  const handleUserClick = (username: string) => {
    setSelectedUser(username);
    setUserProfileOpen(true);
  };

  // Get month name and year for header
  const monthYear = useMemo(() => {
    const today = new Date();
    return format(today, "MMMM yyyy");
  }, []);

  // Calculate max count per source across all days for relative scaling
  const maxCountForSource = useMemo(() => {
    const maxCounts: Record<EventSource, number> = {
      slack: 0,
      jira: 0,
      gitlab: 0,
      bitbucket: 0,
      pagerduty: 0,
    };
    
    heatmapData.forEach((day) => {
      (Object.keys(day.sources) as EventSource[]).forEach((source) => {
        if (day.sources[source] > maxCounts[source]) {
          maxCounts[source] = day.sources[source];
        }
      });
    });
    
    return maxCounts;
  }, [heatmapData]);

  // Calculate intensity for each source based on its count relative to max for that source
  const getIntensity = (source: EventSource, count: number): string => {
    if (count === 0) return "opacity-20";
    
    const maxForSource = maxCountForSource[source] || 1;
    const ratio = count / maxForSource;
    
    // Scale from "Less" to "More" based on relative load
    // 0-25% of max: opacity-40 (Less)
    // 25-50% of max: opacity-60
    // 50-75% of max: opacity-80
    // 75-100% of max: opacity-100 (More)
    if (ratio <= 0.25) return "opacity-40";
    if (ratio <= 0.5) return "opacity-60";
    if (ratio <= 0.75) return "opacity-80";
    return "opacity-100";
  };

  return (
    <>
      <div className={cn("font-mono", className)} data-testid="activity-heatmap">
        {/* Month header */}
        <div className="mb-3 text-sm font-semibold text-foreground">
          {monthYear}
        </div>

        {/* Days as columns with stacked squares */}
        <div className="flex gap-1 overflow-x-auto pb-2">
          {heatmapData.map((day) => {
            const dayDate = new Date(day.date);
            const dayNumber = dayDate.getDate();

            // Get all sources with events, sorted by count (most first)
            const sourcesWithEvents = (Object.keys(day.sources) as EventSource[])
              .filter((source) => day.sources[source] > 0)
              .sort((a, b) => day.sources[b] - day.sources[a]);

            return (
              <div key={day.date} className="flex flex-col items-center gap-1">
                {/* Day number label */}
                <div className="text-[10px] text-muted-foreground text-center h-3 flex items-center">
                  {dayNumber}
                </div>

                {/* Stacked squares column - up to 5 squares tall */}
                <div className="flex flex-col gap-0.5 items-center">
                  {sourcesWithEvents.length === 0 ? (
                    // Empty day - show muted square
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          className="h-3 w-3 rounded-sm bg-muted/30 cursor-default"
                          disabled
                          data-testid={`heatmap-cell-${day.date}-empty`}
                          aria-label={`${day.date}: No events`}
                        />
                      </TooltipTrigger>
                      <TooltipContent className="font-mono text-xs">
                        <p className="font-semibold">{format(dayDate, "EEEE, MMMM d, yyyy")}</p>
                        <p className="text-muted-foreground">No events</p>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    // Stack squares for each source type (max 5)
                    sourcesWithEvents.slice(0, 5).map((source) => {
                      const count = day.sources[source];
                      const intensity = getIntensity(source, count);

                      return (
                        <Tooltip key={source}>
                          <TooltipTrigger asChild>
                            <button
                              className={cn(
                                "h-3 w-3 rounded-sm cursor-pointer transition-all",
                                sourceColors[source],
                                intensity,
                                "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                              )}
                              onClick={() => handleDayClick(day)}
                              data-testid={`heatmap-cell-${day.date}-${source}`}
                              aria-label={`${day.date}: ${count} ${sourceLabels[source]} events`}
                            />
                          </TooltipTrigger>
                          <TooltipContent className="font-mono text-xs">
                            <p className="font-semibold">{format(dayDate, "EEEE, MMMM d, yyyy")}</p>
                            <p className="text-muted-foreground">
                              {sourceLabels[source]}: {count} event{count !== 1 ? "s" : ""}
                            </p>
                            {maxCountForSource[source] > 0 && (
                              <p className="text-xs text-muted-foreground">
                                Max this month: {maxCountForSource[source]}
                              </p>
                            )}
                            <p className="text-xs text-primary mt-1">Click to view all events</p>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
          <span>Less</span>
          <div className="flex gap-1">
            <div className="h-3 w-3 rounded-sm bg-muted/30" />
            <div className="h-3 w-3 rounded-sm bg-primary opacity-40" />
            <div className="h-3 w-3 rounded-sm bg-primary opacity-60" />
            <div className="h-3 w-3 rounded-sm bg-primary opacity-80" />
            <div className="h-3 w-3 rounded-sm bg-primary opacity-100" />
          </div>
          <span>More</span>

          <div className="flex items-center gap-3 ml-4 border-l border-border pl-4">
            {(Object.keys(sourceColors) as EventSource[]).map((source) => (
              <div key={source} className="flex items-center gap-1">
                <div className={cn("h-2.5 w-2.5 rounded-sm", sourceColors[source])} />
                <span>{sourceLabels[source]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <DayDetailSheet
        open={dayDetailOpen}
        onOpenChange={setDayDetailOpen}
        day={selectedDay}
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

interface DayDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  day: DayData | null;
  onEventClick: (event: Event) => void;
}

function DayDetailSheet({ open, onOpenChange, day, onEventClick }: DayDetailSheetProps) {
  if (!day) return null;

  const sortedEvents = [...day.events].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const criticalCount = sortedEvents.filter(e => e.severity === "critical").length;
  const unresolvedCount = sortedEvents.filter(e => !e.resolved).length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl font-mono overflow-y-auto" data-testid="day-detail-sheet">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            {format(new Date(day.date), "EEEE, MMMM d, yyyy")}
          </SheetTitle>
          <SheetDescription>
            Activity for this day
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {day.count} Events
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

          <div className="grid grid-cols-5 gap-2">
            {(Object.keys(day.sources) as EventSource[]).map((source) => (
              <Card key={source} className="p-2 text-center">
                <div className={cn("flex justify-center mb-1", sourceTextColors[source])}>
                  {sourceIcons[source]}
                </div>
                <div className="text-sm font-bold">{day.sources[source]}</div>
              </Card>
            ))}
          </div>

          {sortedEvents.length === 0 ? (
            <Card className="p-6 text-center">
              <p className="text-muted-foreground">No events on this day</p>
            </Card>
          ) : (
            <ScrollArea className="h-[calc(100vh-320px)]">
              <div className="space-y-2 pr-4">
                {sortedEvents.map((event) => (
                  <DayEventCard 
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

function DayEventCard({ event, onClick }: { event: Event; onClick: () => void }) {
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
      data-testid={`day-event-${event.id}`}
    >
      <div className="flex items-start gap-3">
        <div className={cn("mt-0.5 shrink-0", sourceTextColors[event.source])}>
          {sourceIcons[event.source]}
        </div>
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
            <span>{format(new Date(event.timestamp), "HH:mm")}</span>
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
