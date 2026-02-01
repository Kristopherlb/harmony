import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusPill } from "@/components/patterns/StatusPill";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { EventDetailSheet } from "./event-detail-sheet";
import { UserProfileSheet } from "./user-profile-sheet";
import type { Event } from "@shared/schema";
import { 
  AlertTriangle, 
  FileText, 
  CheckCircle2,
  ChevronRight,
  Clock,
  CalendarX,
  Rocket,
  Wrench,
  CheckCircle,
  Circle,
  ExternalLink,
  ClipboardCheck,
  FileCheck,
  Globe,
  Settings,
  UserCheck,
  AlertCircle,
  Users,
  Calendar,
  GitBranch,
  PlayCircle,
  BarChart3,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { SiCircleci, SiPagerduty } from "react-icons/si";
import { getReadinessColor, getReadinessLabel, calculateCombinedReadinessScore } from "./releases/utils";
import { ReleaseDetailSheet } from "./releases/release-detail-sheet";
import { usePrepItems } from "./releases/use-prep-items";

type StatType = "staleTickets" | "blockers" | "upcomingReleases" | "preProductionIncidents";

interface QuickStatsProps {
  events: Event[];
  className?: string;
}

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  iconColor: string;
  subtext?: string;
  onClick: () => void;
  testId: string;
}

function StatCard({ title, value, icon, iconColor, subtext, onClick, testId }: StatCardProps) {
  return (
    <Card 
      className="group p-4 font-mono border border-border bg-card cursor-pointer transition-all hover-elevate"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      data-testid={testId}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {subtext && <p className="text-xs text-muted-foreground mt-1">{subtext}</p>}
        </div>
        <div className="flex items-center gap-2">
          <div className={cn("p-2 rounded-md bg-muted/50", iconColor)}>
            {icon}
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>
    </Card>
  );
}

// Helper function to get stale ticket priority (extracted for reuse)
function getStaleTicketPriority(event: Event): "high" | "medium" | "elevated" | null {
  // Only check Jira tickets (and potentially Linear in the future)
  if (event.source !== "jira") {
    return null;
  }

  // Must not be resolved
  if (event.resolved) {
    return null;
  }

  const now = new Date();
  const twoDayThreshold = new Date(now);
  twoDayThreshold.setDate(twoDayThreshold.getDate() - 2);
  const eightDayThreshold = new Date(now);
  eightDayThreshold.setDate(eightDayThreshold.getDate() - 8);

  const payload = event.payload as Record<string, unknown>;
  
  // Handle different payload structures:
  // 1. Raw Jira issue: payload.fields.status.name
  // 2. Normalized: payload.status or payload.issue?.fields?.status?.name
  let statusName = "";
  let lastUpdated: string | undefined;
  let hasComments = false;

  // Try normalized structure first (from webhooks/updates)
  if (payload.status) {
    statusName = (payload.status as string).toLowerCase();
  } else if (payload.issue) {
    const issue = payload.issue as Record<string, unknown>;
    const fields = issue.fields as Record<string, unknown> | undefined;
    const status = fields?.status as Record<string, unknown> | undefined;
    statusName = ((status?.name as string) || "").toLowerCase();
    lastUpdated = fields?.updated as string | undefined;
    
    // Check for comments in issue structure
    const comment = fields?.comment as { comments?: unknown[]; total?: number } | undefined;
    hasComments = (comment?.comments?.length ?? comment?.total ?? 0) > 0;
  } else {
    // Raw Jira issue structure (from API fetch)
    const fields = payload.fields as Record<string, unknown> | undefined;
    const status = fields?.status as Record<string, unknown> | undefined;
    statusName = ((status?.name as string) || "").toLowerCase();
    lastUpdated = fields?.updated as string | undefined;
    
    // Check for comments in fields
    const comment = fields?.comment as { comments?: unknown[]; total?: number } | undefined;
    hasComments = (comment?.comments?.length ?? comment?.total ?? 0) > 0;
  }

  // Consider tickets stale if they're in progress but not done
  const inProgressStatuses = ["in progress", "in review", "in development", "to do", "open"];
  const doneStatuses = ["done", "closed", "resolved", "completed", "cancelled"];
  
  if (doneStatuses.some(done => statusName.includes(done))) {
    return null;
  }

  // Must be in an in-progress state
  if (!statusName || !inProgressStatuses.some(ip => statusName.includes(ip))) {
    return null;
  }

  // Check last update time
  const updateTime = lastUpdated ? new Date(lastUpdated) : new Date(event.timestamp);
  
  // Elevated: Older than 8 days (regardless of comments)
  if (updateTime < eightDayThreshold) {
    return "elevated";
  }
  
  // High/Medium: Older than 2 days
  if (updateTime < twoDayThreshold) {
    // High: No comments (likely abandoned)
    if (!hasComments) {
      return "high";
    }
    // Medium: Has comments (likely waiting on user)
    return "medium";
  }
  
  return null;
}

export function QuickStats({ events, className }: QuickStatsProps) {
  const [selectedStat, setSelectedStat] = useState<StatType | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [eventDetailOpen, setEventDetailOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [userProfileOpen, setUserProfileOpen] = useState(false);

  const handleUserClick = (username: string) => {
    setSelectedUser(username);
    setUserProfileOpen(true);
  };

  const stats = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);

    const staleTicketsWithPriority = events
      .map(event => ({ event, priority: getStaleTicketPriority(event) }))
      .filter(({ priority }) => priority !== null) as Array<{ event: Event; priority: "high" | "medium" | "elevated" }>;
    
    const staleTickets = staleTicketsWithPriority.map(({ event }) => event);
    const staleHigh = staleTicketsWithPriority.filter(({ priority }) => priority === "high").map(({ event }) => event);
    const staleMedium = staleTicketsWithPriority.filter(({ priority }) => priority === "medium").map(({ event }) => event);
    const staleElevated = staleTicketsWithPriority.filter(({ priority }) => priority === "elevated").map(({ event }) => event);
    
    const activeBlockers = events.filter((e) => e.type === "blocker" && !e.resolved);
    
    // Upcoming Releases: release events that aren't resolved, or recent releases that need prep
    const upcomingReleases = events.filter((e) => {
      if (e.type !== "release") return false;
      if (e.resolved) return false;
      
      // Include recent releases (within last 7 days) that might need follow-up
      const eventDate = new Date(e.timestamp);
      const daysSinceRelease = (now.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceRelease <= 7;
    });

    // Calculate readiness score for upcoming releases
    // This will be updated by the UpcomingReleasesDetail component based on actual checklist completion
    // For now, check localStorage for stored completion state
    const calculateReadinessScore = (releases: Event[]): number => {
      if (releases.length === 0) return 100;
      
      // Try to get actual completion from localStorage
      try {
        const stored = localStorage.getItem("release-prep-checklist");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const completedCount = parsed.filter((item: { completed?: boolean }) => item.completed).length;
            return Math.round((completedCount / parsed.length) * 100);
          }
        }
      } catch {
        // If parsing fails, use default
      }
      
      // Default: assume some items are incomplete
      return 50;
    };
    
    const readinessScore = calculateReadinessScore(upcomingReleases);

    // Pre-Production Incidents: incidents/alerts from CICD/pre-prod sources that aren't resolved
    const preProductionIncidents = events.filter((e) => {
      if (e.resolved) return false;
      
      // Check if it's an incident/alert type
      const isIncident = e.type === "alert" || e.type === "blocker" || e.contextType === "incident" || e.contextType === "deployment_failure";
      if (!isIncident) return false;

      // Check for pre-production indicators:
      // 1. CICD sources (gitlab, bitbucket)
      const isCICDSource = e.source === "gitlab" || e.source === "bitbucket";
      
      // 2. Service tags indicating pre-prod environments
      const preProdTags = ["staging", "dev", "development", "qa", "test", "preprod", "pre-prod", "ci", "cd", "cicd"];
      const hasPreProdTag = e.serviceTags.some(tag => 
        preProdTags.some(ppTag => tag.toLowerCase().includes(ppTag))
      );
      
      // 3. Message content indicating pre-prod
      const messageLower = e.message.toLowerCase();
      const messageIndicatesPreProd = preProdTags.some(ppTag => messageLower.includes(ppTag));
      
      // 4. Context types that suggest pre-prod issues
      const isPreProdContext = e.contextType === "deployment_failure" || e.contextType === "infrastructure";
      
      return isCICDSource || hasPreProdTag || messageIndicatesPreProd || isPreProdContext;
    });

    return {
      staleTickets,
      staleHigh,
      staleMedium,
      staleElevated,
      activeBlockers,
      upcomingReleases,
      readinessScore,
      preProductionIncidents,
      todayCount: events.filter((e) => new Date(e.timestamp) >= todayStart).length,
      weekCount: events.filter((e) => new Date(e.timestamp) >= weekStart).length,
    };
  }, [events]);

  const handleStatClick = (statType: StatType) => {
    setSelectedStat(statType);
    setDetailOpen(true);
  };

  const handleEventClick = (event: Event) => {
    setSelectedEvent(event);
    setEventDetailOpen(true);
  };

  const getFilteredEvents = (): Event[] => {
    switch (selectedStat) {
      case "staleTickets":
        return stats.staleTickets;
      case "blockers":
        return stats.activeBlockers;
      case "upcomingReleases":
        return stats.upcomingReleases;
      case "preProductionIncidents":
        return stats.preProductionIncidents;
      default:
        return [];
    }
  };

  const getStatConfig = () => {
    switch (selectedStat) {
      case "staleTickets":
        return {
          title: "Stale Tickets",
          description: "Tickets with no movement: Elevated (>8 days), High (>2 days, no comments), Medium (>2 days, has comments)",
          icon: <CalendarX className="h-5 w-5 text-status-degraded" />,
          emptyMessage: "No stale tickets - all active!",
        };
      case "blockers":
        return {
          title: "Active Blockers",
          description: "Unresolved issues blocking progress",
          icon: <AlertTriangle className="h-5 w-5 text-status-critical" />,
          emptyMessage: "No active blockers - all clear!",
        };
      case "upcomingReleases":
        return {
          title: "Upcoming Releases",
          description: "Recent releases and deployment prep items",
          icon: <Rocket className="h-5 w-5 text-primary" />,
          emptyMessage: "No upcoming releases",
        };
      case "preProductionIncidents":
        return {
          title: "Pre-Production Incidents",
          description: "Active issues in CICD, QA, staging, and dev environments",
          icon: <Wrench className="h-5 w-5 text-status-degraded" />,
          emptyMessage: "No pre-production incidents",
        };
      default:
        return {
          title: "",
          description: "",
          icon: null,
          emptyMessage: "",
        };
    }
  };

  return (
    <>
      <div className={cn("grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4", className)} data-testid="quick-stats">
        <StatCard
          title="Stale Tickets"
          value={stats.staleTickets.length}
          icon={<CalendarX className="h-5 w-5" />}
          iconColor={stats.staleElevated.length > 0 ? "text-status-critical" : stats.staleHigh.length > 0 ? "text-risk-high" : stats.staleTickets.length > 0 ? "text-status-degraded" : "text-muted-foreground"}
          subtext={stats.staleTickets.length > 0 
            ? `${stats.staleElevated.length} elevated, ${stats.staleHigh.length} high, ${stats.staleMedium.length} medium`
            : "All active"}
          onClick={() => handleStatClick("staleTickets")}
          testId="stat-card-stale-tickets"
        />
        <StatCard
          title="Active Blockers"
          value={stats.activeBlockers.length}
          icon={<AlertTriangle className="h-5 w-5" />}
          iconColor={stats.activeBlockers.length > 0 ? "text-status-critical" : "text-muted-foreground"}
          subtext={stats.activeBlockers.length > 0 ? "Needs attention" : "All clear"}
          onClick={() => handleStatClick("blockers")}
          testId="stat-card-blockers"
        />
        <StatCard
          title="Upcoming Releases"
          value={stats.upcomingReleases.length}
          icon={<Rocket className="h-5 w-5" />}
          iconColor={stats.upcomingReleases.length > 0 ? "text-primary" : "text-muted-foreground"}
          subtext={stats.upcomingReleases.length > 0 
            ? `${stats.readinessScore}% readiness` 
            : "All clear"}
          onClick={() => handleStatClick("upcomingReleases")}
          testId="stat-card-upcoming-releases"
        />
        <StatCard
          title="Pre-Prod Incidents"
          value={stats.preProductionIncidents.length}
          icon={<Wrench className="h-5 w-5" />}
          iconColor={stats.preProductionIncidents.length > 0 ? "text-status-degraded" : "text-muted-foreground"}
          subtext={stats.preProductionIncidents.length > 0 ? "CICD, QA, staging issues" : "All clear"}
          onClick={() => handleStatClick("preProductionIncidents")}
          testId="stat-card-pre-prod-incidents"
        />
      </div>

      {selectedStat === "upcomingReleases" ? (
        <UpcomingReleasesDetail
          open={detailOpen}
          onOpenChange={setDetailOpen}
          releases={stats.upcomingReleases}
          readinessScore={stats.readinessScore}
          allEvents={events}
          onEventClick={handleEventClick}
        />
      ) : (
        <QuickStatDetail
          open={detailOpen}
          onOpenChange={setDetailOpen}
          events={getFilteredEvents()}
          config={getStatConfig()}
          onEventClick={handleEventClick}
        />
      )}

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

interface QuickStatDetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  events: Event[];
  config: {
    title: string;
    description: string;
    icon: React.ReactNode;
    emptyMessage: string;
  };
  onEventClick: (event: Event) => void;
}

function QuickStatDetail({ open, onOpenChange, events, config, onEventClick }: QuickStatDetailProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl font-mono overflow-y-auto" data-testid="quick-stat-detail">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {config.icon}
            {config.title}
          </SheetTitle>
          <SheetDescription>
            {config.description}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {events.length} Items
            </span>
          </div>

          {events.length === 0 ? (
            <Card className="p-6 text-center">
              <p className="text-muted-foreground">{config.emptyMessage}</p>
            </Card>
          ) : (
            <ScrollArea className="h-[calc(100vh-200px)]">
              <div className="space-y-2 pr-4">
                {events.map((event) => (
                  <EventListItem 
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

const severityColors: Record<string, string> = {
  critical: "text-status-critical",
  high: "text-risk-high",
  medium: "text-status-degraded",
  low: "text-primary",
};

const severityBadgeVariants: Record<string, "destructive" | "default" | "secondary" | "outline"> = {
  critical: "destructive",
  high: "destructive",
  medium: "default",
  low: "secondary",
};

const sourceColors: Record<string, string> = {
  slack: "text-primary",
  jira: "text-primary",
  gitlab: "text-primary",
  bitbucket: "text-primary",
  pagerduty: "text-status-healthy",
};

interface EventListItemProps {
  event: Event;
  onClick: () => void;
}

export function EventListItem({ event, onClick }: EventListItemProps) {
  const stalePriority = getStaleTicketPriority(event);
  const stalePriorityLabels: Record<string, string> = {
    elevated: "Elevated",
    high: "High Priority",
    medium: "Watch",
  };
  const stalePriorityColors: Record<string, string> = {
    elevated: "text-status-critical border-status-critical/50",
    high: "text-risk-high border-risk-high/50",
    medium: "text-status-degraded border-status-degraded/50",
  };

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
      data-testid={`event-list-item-${event.id}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {stalePriority && (
              <Badge variant="outline" className={cn("text-xs font-semibold", stalePriorityColors[stalePriority])}>
                {stalePriorityLabels[stalePriority]}
              </Badge>
            )}
            <Badge variant={severityBadgeVariants[event.severity]} className="text-xs">
              {event.severity.toUpperCase()}
            </Badge>
            <span className={cn("text-xs capitalize", sourceColors[event.source])}>
              {event.source}
            </span>
            {event.resolved && (
              <Badge variant="outline" className="text-xs text-status-healthy border-status-healthy/50">
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
                <span className="font-medium">{event.username}</span>
              </>
            )}
          </div>
        </div>

        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
}

interface UpcomingReleasesDetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  releases: Event[];
  readinessScore: number;
  allEvents: Event[];
  onEventClick: (event: Event) => void;
}



interface ReleaseDetailSheetProps {
  release: Event;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allEvents: Event[];
  onEventClick: (event: Event) => void;
}

function UpcomingReleasesDetail({
  open,
  onOpenChange,
  releases,
  readinessScore: initialReadinessScore,
  allEvents,
  onEventClick,
}: UpcomingReleasesDetailProps) {
  const [selectedRelease, setSelectedRelease] = useState<Event | null>(null);

  // Use prep items hook for readiness score calculation
  const { prepItems } = usePrepItems(open);



  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl font-mono overflow-y-auto" data-testid="upcoming-releases-detail">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" />
            Upcoming Releases
          </SheetTitle>
          <SheetDescription>
            Release readiness dashboard with prep items and open issues
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-200px)] mt-6">
          <div className="space-y-3 pr-4">
            {releases.length === 0 ? (
              <Card className="p-6 text-center">
                <Rocket className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-muted-foreground">No upcoming releases</p>
              </Card>
            ) : (
              releases.map((release) => {
                // Calculate readiness for this release
                const releaseOpenItems = allEvents.filter((e) => {
                  if (e.resolved) return false;
                  if (e.type === "blocker" || e.type === "alert") return true;
                  // Match by service tags or release-related criteria
                  return e.serviceTags.some(tag => 
                    release.serviceTags.includes(tag) || 
                    release.message.toLowerCase().includes(tag.toLowerCase())
                  );
                });

                const jiraItems = releaseOpenItems.filter(e => e.source === "jira");
                const openJiraCount = jiraItems.length;

                // Get prep items completion for this release
                const prepCompleted = prepItems.filter(item => item.completed).length;
                const prepTotal = prepItems.length;

                // Combined readiness: 60% prep, 40% open items
                const readinessScore = calculateCombinedReadinessScore(openJiraCount, prepCompleted, prepTotal);

                const payload = release.payload as Record<string, unknown>;
                const version = payload.version as string | undefined || 
                              payload.ref as string | undefined || 
                              release.message.match(/v?(\d+\.\d+\.\d+)/)?.[1] || 
                              "TBD";
                const releaseDate = payload.releaseDate ? new Date(payload.releaseDate as string) : new Date(release.timestamp);
                const description = payload.description as string | undefined || 
                                  payload.message as string | undefined || 
                                  release.message;

                return (
                  <Card
                    key={release.id}
                    className={cn(
                      "p-4 border transition-all cursor-pointer hover:border-primary/50",
                      "hover:shadow-md"
                    )}
                    onClick={() => setSelectedRelease(release)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedRelease(release);
                      }
                    }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Rocket className="h-5 w-5 text-primary" />
                          <h3 className="font-semibold text-base">Release {version}</h3>
                          <Badge variant="outline" className="text-xs">
                            {format(releaseDate, "MMM d, yyyy")}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                          {description}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>{openJiraCount} open Jira items</span>
                          <span>{prepCompleted}/{prepTotal} prep items</span>
                        </div>
                        <div className="mt-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-muted-foreground">Readiness</span>
                            <span className={cn("text-xs font-semibold", getReadinessColor(readinessScore))}>
                              {readinessScore}%
                            </span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className={cn("h-full transition-all", getReadinessColor(readinessScore).replace('text-', 'bg-'))}
                              style={{ width: `${readinessScore}%` }}
                            />
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </ScrollArea>
      </SheetContent>


      {/* Release Detail Sheet */}
      {selectedRelease && (
        <ReleaseDetailSheet
          release={selectedRelease}
          open={!!selectedRelease}
          onOpenChange={(open) => !open && setSelectedRelease(null)}
          allEvents={allEvents}
          onEventClick={onEventClick}
        />
      )}
    </Sheet>
  );
}
