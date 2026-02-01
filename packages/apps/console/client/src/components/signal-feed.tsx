import { useState, useRef } from "react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import type { Event, EventSource, EventType, ContextType } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  MessageSquare,
  AlertTriangle,
  FileText,
  GitBranch,
  Bell,
  Search,
  Check,
  Clock,
  ChevronRight,
} from "lucide-react";
import { SiSlack, SiJira, SiGitlab, SiBitbucket, SiPagerduty } from "react-icons/si";

interface SignalFeedProps {
  events: Event[];
  selectedEvent: Event | null;
  onSelectEvent: (event: Event) => void;
  onAcknowledge?: (event: Event) => void;
  onSnooze?: (event: Event) => void;
  isMobile?: boolean;
  criticalCount?: number;
  className?: string;
}

const sourceIcons: Record<EventSource, React.ReactNode> = {
  slack: <SiSlack className="h-3.5 w-3.5" />,
  jira: <SiJira className="h-3.5 w-3.5" />,
  gitlab: <SiGitlab className="h-3.5 w-3.5" />,
  bitbucket: <SiBitbucket className="h-3.5 w-3.5" />,
  pagerduty: <SiPagerduty className="h-3.5 w-3.5" />,
};

const sourceColors: Record<EventSource, string> = {
  slack: "text-primary",
  jira: "text-primary",
  gitlab: "text-primary",
  bitbucket: "text-primary",
  pagerduty: "text-status-critical",
};

const typeIcons: Record<EventType, React.ReactNode> = {
  log: <MessageSquare className="h-3 w-3" />,
  blocker: <AlertTriangle className="h-3 w-3" />,
  decision: <FileText className="h-3 w-3" />,
  release: <GitBranch className="h-3 w-3" />,
  alert: <Bell className="h-3 w-3" />,
};

const severityColors: Record<string, string> = {
  critical: "border-l-status-critical bg-status-critical/5",
  high: "border-l-risk-high bg-risk-high/5",
  medium: "border-l-status-degraded bg-status-degraded/5",
  low: "border-l-status-healthy bg-status-healthy/5",
};

const contextTypeLabels: Record<ContextType, string> = {
  incident: "INC",
  support_ticket: "TKT",
  deployment_failure: "DEP",
  security_alert: "SEC",
  infrastructure: "INF",
  general: "GEN",
};

const contextTypeColors: Record<ContextType, string> = {
  incident: "bg-status-critical/20 text-status-critical",
  support_ticket: "bg-primary/20 text-primary",
  deployment_failure: "bg-risk-high/20 text-risk-high",
  security_alert: "bg-primary/20 text-primary",
  infrastructure: "bg-primary/20 text-primary",
  general: "bg-muted text-muted-foreground",
};

interface SwipeableRowProps {
  event: Event;
  isSelected: boolean;
  onSelect: () => void;
  onAcknowledge?: (event: Event) => void;
  onSnooze?: (event: Event) => void;
  isMobile: boolean;
}

function SwipeableRow({ event, isSelected, onSelect, onAcknowledge, onSnooze, isMobile }: SwipeableRowProps) {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const [actionTriggered, setActionTriggered] = useState<"ack" | "snooze" | null>(null);
  const startXRef = useRef(0);
  const rowRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isMobile) return;
    startXRef.current = e.touches[0].clientX;
    setSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!swiping || !isMobile) return;
    const delta = e.touches[0].clientX - startXRef.current;
    setSwipeOffset(Math.min(Math.max(-80, delta), 80));
  };

  const handleTouchEnd = () => {
    if (!swiping) return;
    setSwiping(false);
    
    if (swipeOffset > 60 && onAcknowledge) {
      setActionTriggered("ack");
      onAcknowledge(event);
      setTimeout(() => setActionTriggered(null), 1000);
    } else if (swipeOffset < -60 && onSnooze) {
      setActionTriggered("snooze");
      onSnooze(event);
      setTimeout(() => setActionTriggered(null), 1000);
    }
    
    setSwipeOffset(0);
  };

  const ackVisible = swipeOffset > 20;
  const snoozeVisible = swipeOffset < -20;

  return (
    <div className="relative overflow-hidden">
      {isMobile && (
        <>
          <div 
            className={cn(
              "absolute inset-y-0 left-0 w-20 flex items-center justify-center bg-status-healthy/80 transition-opacity",
              ackVisible ? "opacity-100" : "opacity-0"
            )}
          >
            <Check className="h-5 w-5 text-white" />
          </div>
          <div 
            className={cn(
              "absolute inset-y-0 right-0 w-20 flex items-center justify-center bg-status-degraded/80 transition-opacity",
              snoozeVisible ? "opacity-100" : "opacity-0"
            )}
          >
            <Clock className="h-5 w-5 text-white" />
          </div>
        </>
      )}
      
      <div
        ref={rowRef}
        className={cn(
          "p-3 cursor-pointer border-l-2 transition-all bg-card relative",
          severityColors[event.severity],
          isSelected ? "bg-primary/10 border-l-primary" : "hover:bg-muted/50"
        )}
        style={{ 
          transform: isMobile ? `translateX(${swipeOffset}px)` : undefined,
          transition: swiping ? "none" : "transform 0.2s ease-out"
        }}
        onClick={onSelect}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        data-testid={`signal-item-${event.id}`}
      >
        <div className="flex items-start gap-2">
          <div className={cn("mt-0.5", sourceColors[event.source])}>
            {sourceIcons[event.source]}
          </div>
          
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge 
                variant="secondary" 
                className={cn("text-[10px] px-1 py-0", contextTypeColors[event.contextType || "general"])}
              >
                {contextTypeLabels[event.contextType || "general"]}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
              </span>
            </div>
            
            <p className="text-sm font-medium text-foreground line-clamp-2">
              {event.message}
            </p>
            
            {event.serviceTags && event.serviceTags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {event.serviceTags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono"
                  >
                    {tag}
                  </span>
                ))}
                {event.serviceTags.length > 3 && (
                  <span className="text-[10px] text-muted-foreground">
                    +{event.serviceTags.length - 3}
                  </span>
                )}
              </div>
            )}
            
            {event.username && (
              <span className="text-xs text-muted-foreground">
                @{event.username}
              </span>
            )}
          </div>
          
          <div className="flex flex-col items-center gap-1">
            <div className={cn(
              "p-1 rounded",
              event.type === "alert" || event.type === "blocker"
                ? "text-destructive"
                : "text-muted-foreground"
            )}>
              {typeIcons[event.type]}
            </div>
            {event.resolved && (
              <div className="w-2 h-2 rounded-full bg-status-healthy" title="Resolved" />
            )}
            {isMobile && (
              <ChevronRight className="h-4 w-4 text-muted-foreground mt-1" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SignalFeed({
  events,
  selectedEvent,
  onSelectEvent,
  onAcknowledge,
  onSnooze,
  isMobile = false,
  criticalCount = 0,
  className,
}: SignalFeedProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [contextFilter, setContextFilter] = useState<ContextType | null>(null);

  const filteredEvents = events.filter((event) => {
    const matchesSearch = searchQuery === "" || 
      event.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.serviceTags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesContext = contextFilter === null || event.contextType === contextFilter;
    
    return matchesSearch && matchesContext;
  });

  const contextCounts = events.reduce((acc, event) => {
    const ctx = event.contextType || "general";
    acc[ctx] = (acc[ctx] || 0) + 1;
    return acc;
  }, {} as Record<ContextType, number>);

  return (
    <div className={cn("flex flex-col h-full bg-card border-r border-border md:border-r", className)}>
      <div className="p-3 border-b border-border space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">Signal Stream</h2>
            <Badge variant="secondary" className="text-xs">
              {filteredEvents.length}
            </Badge>
          </div>
          
          {criticalCount > 0 && (
            <Badge variant="destructive" className="text-xs gap-1">
              <AlertTriangle className="h-3 w-3" />
              {criticalCount} Critical
            </Badge>
          )}
        </div>
        
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search signals..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-xs"
            data-testid="input-signal-search"
          />
        </div>

        <div className="flex flex-wrap gap-1">
          <Badge
            variant={contextFilter === null ? "default" : "outline"}
            className="text-xs cursor-pointer"
            onClick={() => setContextFilter(null)}
            data-testid="filter-all"
          >
            All
          </Badge>
          {(Object.keys(contextTypeLabels) as ContextType[]).map((ctx) => (
            contextCounts[ctx] > 0 && (
              <Badge
                key={ctx}
                variant={contextFilter === ctx ? "default" : "outline"}
                className={cn("text-xs cursor-pointer", contextFilter === ctx && contextTypeColors[ctx])}
                onClick={() => setContextFilter(ctx === contextFilter ? null : ctx)}
                data-testid={`filter-${ctx}`}
              >
                {contextTypeLabels[ctx]} ({contextCounts[ctx]})
              </Badge>
            )
          ))}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="divide-y divide-border/50">
          {filteredEvents.map((event) => (
            <SwipeableRow
              key={event.id}
              event={event}
              isSelected={selectedEvent?.id === event.id}
              onSelect={() => onSelectEvent(event)}
              onAcknowledge={onAcknowledge}
              onSnooze={onSnooze}
              isMobile={isMobile}
            />
          ))}
          
          {filteredEvents.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No signals match your filters
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
