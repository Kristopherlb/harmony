import { useState, useMemo } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import type { Event } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { StatusPill } from "@/components/patterns/StatusPill";
import { EventListItem } from "../quick-stats";
import { calculateCombinedReadinessScore } from "./utils";
import { organizeEpics, sortEpics } from "./epic-utils";
import { organizeByTeam, organizeByService, sortGroupedItems, type ReportOption } from "./organization-utils";
import { getReadinessColor, getRiskStatus } from "./utils";
import { usePrepItems } from "./use-prep-items";
import type { ReleaseDetailSheetProps, ResolverType } from "./types";
import {
  Rocket,
  Calendar,
  GitBranch,
  FileText,
  ExternalLink,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  PlayCircle,
  BarChart3,
  Users,
  Server,
} from "lucide-react";
import { SiCircleci } from "react-icons/si";

export function ReleaseDetailSheet({
  release,
  open,
  onOpenChange,
  allEvents,
  onEventClick,
}: ReleaseDetailSheetProps) {
  const [activeTab, setActiveTab] = useState<"openItems" | "prep" | "circleci" | "ops">("openItems");
  const [reportOption, setReportOption] = useState<ReportOption>("team");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [selectedPrepItem, setSelectedPrepItem] = useState<string | null>(null);

  const payload = release.payload as Record<string, unknown>;
  const version = payload.version as string | undefined || 
                payload.ref as string | undefined || 
                release.message.match(/v?(\d+\.\d+\.\d+)/)?.[1] || 
                "TBD";
  const releaseDate = payload.releaseDate ? new Date(payload.releaseDate as string) : new Date(release.timestamp);
  const planLink = payload.planLink as string | undefined;
  const releaseNotesLink = payload.releaseNotesLink as string | undefined;
  const majorChanges = payload.majorChanges as string[] | undefined || [];

  // Get open items for this release
  const releaseOpenItems = allEvents.filter((e) => {
    if (e.resolved) return false;
    if (e.type === "blocker" || e.type === "alert") return true;
    return e.serviceTags.some(tag => 
      release.serviceTags.includes(tag) || 
      release.message.toLowerCase().includes(tag.toLowerCase())
    );
  });

  // Organize Jira items by team or service based on report option
  const jiraItems = releaseOpenItems.filter(e => e.source === "jira");
  const groupedItems = useMemo(() => {
    if (reportOption === "team") {
      const organized = organizeByTeam(jiraItems, allEvents);
      return sortGroupedItems(organized);
    } else {
      const organized = organizeByService(jiraItems);
      return sortGroupedItems(organized);
    }
  }, [jiraItems, reportOption, allEvents]);

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  };

  // Use prep items hook
  const {
    prepItems,
    toggleAtRisk,
    handleManualConfirm,
    manualConfirmOpen,
    setManualConfirmOpen,
  } = usePrepItems(open);

  // Handle prep item click - open detail view for all items
  const handlePrepItemClick = (item: { id: string; label: string }) => {
    setSelectedPrepItem(item.id);
  };

  // Mock CircleCI pipelines data
  const pipelines = [
    { id: "1", name: "Build", status: "success", branch: version, duration: "5m 23s", timestamp: new Date() },
    { id: "2", name: "Test", status: "success", branch: version, duration: "12m 45s", timestamp: new Date() },
    { id: "3", name: "Deploy Staging", status: "running", branch: version, duration: "3m 12s", timestamp: new Date() },
  ];

  // Get PagerDuty incidents
  const pagerdutyIncidents = allEvents.filter(e => 
    e.source === "pagerduty" && 
    !e.resolved &&
    e.serviceTags.some(tag => release.serviceTags.includes(tag))
  );

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-3xl font-mono overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5 text-primary" />
              Release {version}
            </SheetTitle>
            <SheetDescription>
              Release details and tracking
            </SheetDescription>
          </SheetHeader>

          {/* Info Section - Top Level */}
          <div className="mt-6 space-y-4">
            <Card className="p-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Release Date:</span>
                  <span className="text-sm">{format(releaseDate, "MMMM d, yyyy 'at' h:mm a")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <GitBranch className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Version:</span>
                  <Badge variant="outline">{version}</Badge>
                </div>
                {planLink && (
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Release Plan:</span>
                    <a href={planLink} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1">
                      View Plan <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
                {releaseNotesLink && (
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Release Notes:</span>
                    <a href={releaseNotesLink} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1">
                      View Notes <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </div>
            </Card>

            {majorChanges.length > 0 && (
              <Card className="p-4">
                <h4 className="text-sm font-semibold mb-3">Major Internal Changes</h4>
                <ul className="space-y-2">
                  {majorChanges.map((change, idx) => (
                    <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      <span>{change}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="mt-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="openItems" className="text-xs">Open Items</TabsTrigger>
              <TabsTrigger value="prep" className="text-xs">Prep</TabsTrigger>
              <TabsTrigger value="circleci" className="text-xs">CircleCI</TabsTrigger>
              <TabsTrigger value="ops" className="text-xs">Ops</TabsTrigger>
            </TabsList>

            <ScrollArea className="h-[calc(100vh-400px)] mt-4">

              <TabsContent value="openItems" className="space-y-4 pr-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Open Items
                  </h4>
                  <Select value={reportOption} onValueChange={(v) => setReportOption(v as ReportOption)}>
                    <SelectTrigger className="w-[180px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="team">
                        <div className="flex items-center gap-2">
                          <Users className="h-3 w-3" />
                          <span>By Team</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="service">
                        <div className="flex items-center gap-2">
                          <Server className="h-3 w-3" />
                          <span>By Service</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {groupedItems.length === 0 ? (
                  <Card className="p-6 text-center">
                    <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-status-healthy" />
                    <p className="text-muted-foreground">No open items</p>
                  </Card>
                ) : (
                  groupedItems.map((group) => {
                    const isExpanded = expandedGroups.has(group.key);
                    
                    return (
                      <Card key={group.key} className="border">
                        <div
                          className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => toggleGroup(group.key)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              toggleGroup(group.key);
                            }
                          }}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-semibold text-sm">{group.name}</h4>
                                <StatusPill status={getRiskStatus(group.riskScore)} label={`Risk: ${group.riskScore}`} showDot />
                              </div>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
                                <span>{group.tickets.length} tickets</span>
                                <span>{group.progress}% complete</span>
                              </div>
                              <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={cn("h-full transition-all", getReadinessColor(group.progress).replace('text-', 'bg-'))}
                                  style={{ width: `${group.progress}%` }}
                                />
                              </div>
                            </div>
                            <div className="flex-shrink-0">
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="border-t p-4 space-y-2">
                            {group.tickets.map((ticket) => (
                              <EventListItem
                                key={ticket.id}
                                event={ticket}
                                onClick={() => onEventClick(ticket)}
                              />
                            ))}
                          </div>
                        )}
                      </Card>
                    );
                  })
                )}
              </TabsContent>

              <TabsContent value="prep" className="space-y-4 pr-4">
                <div className="space-y-2">
                  {[...prepItems]
                    .sort((a, b) => {
                      // Unfinished items first
                      if (!a.completed && b.completed) return -1;
                      if (a.completed && !b.completed) return 1;
                      // Among completed/unfinished, at-risk items first
                      if (a.atRisk && !b.atRisk) return -1;
                      if (!a.atRisk && b.atRisk) return 1;
                      return 0;
                    })
                    .map((item) => (
                    <Card 
                      key={item.id} 
                      className={cn(
                        "p-4 border transition-all cursor-pointer hover:border-primary/50",
                        item.completed 
                          ? "border-status-healthy/30 bg-status-healthy/5" 
                          : item.atRisk
                          ? "border-status-degraded/50 bg-status-degraded/10"
                          : "border-border"
                      )}
                      onClick={() => handlePrepItemClick(item)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handlePrepItemClick(item);
                        }
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={item.completed}
                            onCheckedChange={() => {
                              // The resolver handles toggling internally, so we just call it
                              item.resolver();
                            }}
                            aria-label={`${item.label} - ${item.completed ? "completed" : "not completed"}`}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h5 className="font-semibold text-sm">{item.label}</h5>
                            {item.resolverType === "automated" && (
                              <Badge variant="outline" className="text-xs text-primary border-primary/50">
                                Auto
                              </Badge>
                            )}
                            {item.atRisk && !item.completed && (
                              <StatusPill status="degraded" label="At Risk" showDot />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">{item.description}</p>
                          {item.deadline && !item.completed && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              <span>Due: {format(item.deadline, "MMM d, yyyy")}</span>
                              <span className="text-status-degraded">
                                ({formatDistanceToNow(item.deadline, { addSuffix: true })})
                              </span>
                            </div>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleAtRisk(item.id);
                              }}
                              title={item.manualAtRisk ? "Mark as not at risk" : "Mark as at risk"}
                            >
                              <AlertCircle className={cn(
                                "h-3 w-3 mr-1",
                                item.manualAtRisk ? "text-status-degraded" : "text-muted-foreground"
                              )} />
                              {item.manualAtRisk ? "At Risk" : "Mark At Risk"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="circleci" className="space-y-4 pr-4">
                <div className="space-y-3">
                  {pipelines.map((pipeline) => (
                    <Card key={pipeline.id} className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <SiCircleci className="h-5 w-5 text-primary" />
                          <div>
                            <h5 className="font-semibold text-sm">{pipeline.name}</h5>
                            <p className="text-xs text-muted-foreground">{pipeline.branch} • {pipeline.duration}</p>
                          </div>
                        </div>
                        <Badge 
                          variant="outline" 
                          className={cn(
                            pipeline.status === "success" ? "text-status-healthy border-status-healthy/50" :
                            pipeline.status === "running" ? "text-primary border-primary/50" :
                            "text-status-degraded border-status-degraded/50"
                          )}
                        >
                          {pipeline.status}
                        </Badge>
                      </div>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="ops" className="space-y-4 pr-4">
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                    Dashboards
                  </h4>
                  <div className="grid grid-cols-2 gap-2 mb-6">
                    <Button variant="outline" size="sm" className="justify-start">
                      <BarChart3 className="h-4 w-4 mr-2" />
                      Monitoring Dashboard
                    </Button>
                    <Button variant="outline" size="sm" className="justify-start">
                      <PlayCircle className="h-4 w-4 mr-2" />
                      Deployment Dashboard
                    </Button>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                    PagerDuty Incidents ({pagerdutyIncidents.length})
                  </h4>
                  {pagerdutyIncidents.length === 0 ? (
                    <Card className="p-6 text-center">
                      <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-status-healthy" />
                      <p className="text-muted-foreground">No active incidents</p>
                    </Card>
                  ) : (
                    <div className="space-y-2">
                      {pagerdutyIncidents.map((incident) => (
                        <EventListItem
                          key={incident.id}
                          event={incident}
                          onClick={() => onEventClick(incident)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>
            </ScrollArea>
          </Tabs>

          {/* Manual Confirmation Dialog */}
          <Dialog open={!!manualConfirmOpen} onOpenChange={(open) => !open && setManualConfirmOpen(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm Manual Completion</DialogTitle>
                <DialogDescription>
                  {manualConfirmOpen && prepItems.find(i => i.id === manualConfirmOpen)?.resolverType === "automated"
                    ? "This item is configured for automated checking. Are you sure you want to manually mark it as complete?"
                    : "Are you sure you want to mark this item as complete?"}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setManualConfirmOpen(null)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => manualConfirmOpen && handleManualConfirm(manualConfirmOpen)}
                >
                  Mark Complete
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </SheetContent>
      </Sheet>

      {/* Prep Item Detail Sheet */}
      {selectedPrepItem && (
        <PrepItemDetailSheet
          item={prepItems.find(i => i.id === selectedPrepItem)}
          open={!!selectedPrepItem}
          onOpenChange={(open) => !open && setSelectedPrepItem(null)}
          onToggleComplete={() => {
            const item = prepItems.find(i => i.id === selectedPrepItem);
            if (item) {
              item.resolver();
            }
          }}
          onToggleAtRisk={() => {
            if (selectedPrepItem) {
              toggleAtRisk(selectedPrepItem);
            }
          }}
          releaseNotesLink={releaseNotesLink}
        />
      )}
    </>
  );
}

interface PrepItemDetailSheetProps {
  item: { id: string; label: string; description: string; completed: boolean; atRisk: boolean; manualAtRisk: boolean; resolverType: ResolverType; automatedCheck?: { type: string; config?: { jql?: string; apiUrl?: string; expectedStatus?: string } }; deadline?: Date } | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onToggleComplete: () => void;
  onToggleAtRisk: () => void;
  releaseNotesLink?: string;
}

function PrepItemDetailSheet({
  item,
  open,
  onOpenChange,
  onToggleComplete,
  onToggleAtRisk,
  releaseNotesLink,
}: PrepItemDetailSheetProps) {
  if (!item) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl font-mono overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            {item.label}
          </SheetTitle>
          <SheetDescription>
            {item.description}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-200px)] mt-6">
          <div className="space-y-6 pr-4">
            {/* Status Section */}
            <Card className="p-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Status</span>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={item.completed}
                      onCheckedChange={onToggleComplete}
                      aria-label={`${item.label} - ${item.completed ? "completed" : "not completed"}`}
                    />
                    <span className="text-sm">{item.completed ? "Completed" : "In Progress"}</span>
                  </div>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">At Risk</span>
                  <div className="flex items-center gap-2">
                    {item.atRisk && (
                      <StatusPill status="degraded" label="At Risk" showDot />
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-3 text-xs"
                      onClick={onToggleAtRisk}
                    >
                      <AlertCircle className={cn(
                        "h-4 w-4 mr-1",
                        item.manualAtRisk ? "text-status-degraded" : "text-muted-foreground"
                      )} />
                      {item.manualAtRisk ? "Remove Risk" : "Mark At Risk"}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>

            {/* Details Section */}
            <Card className="p-4">
              <h4 className="text-sm font-semibold mb-3">Details</h4>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Type:</span>
                  <Badge variant="outline" className="text-xs">
                    {item.resolverType === "automated" ? "Automated" : "Manual"}
                  </Badge>
                  {item.resolverType === "automated" && item.automatedCheck && (
                    <Badge variant="outline" className="text-xs text-primary border-primary/50">
                      {item.automatedCheck.type === "jira_ticket" ? "Jira Check" : "API Check"}
                    </Badge>
                  )}
                </div>
                {item.deadline && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Deadline:</span>
                    <span className="text-sm">{format(item.deadline, "MMMM d, yyyy 'at' h:mm a")}</span>
                    {!item.completed && (
                      <span className={cn(
                        "text-xs",
                        new Date() > item.deadline ? "text-status-critical" : "text-status-degraded"
                      )}>
                        ({formatDistanceToNow(item.deadline, { addSuffix: true })})
                      </span>
                    )}
                  </div>
                )}
                {item.automatedCheck?.config?.jql && (
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">Jira Query:</span>
                    <p className="text-xs font-mono bg-muted p-2 rounded border">
                      {item.automatedCheck.config.jql}
                    </p>
                  </div>
                )}
                {item.automatedCheck?.config?.apiUrl && (
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">API Endpoint:</span>
                    <p className="text-xs font-mono bg-muted p-2 rounded border">
                      {item.automatedCheck.config.apiUrl}
                    </p>
                  </div>
                )}
              </div>
            </Card>

            {/* Item-Specific Information */}
            {item.id === "release-notes" && releaseNotesLink && (
              <Card className="p-4">
                <h4 className="text-sm font-semibold mb-3">Related Links</h4>
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Release Notes:</span>
                  <a 
                    href={releaseNotesLink} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    View Release Notes <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </Card>
            )}

            {/* Automated Check Information */}
            {item.resolverType === "automated" && (
              <Card className="p-4">
                <h4 className="text-sm font-semibold mb-3">Automated Check</h4>
                <div className="p-3 bg-muted/50 rounded border border-border">
                  <p className="text-xs text-muted-foreground mb-2">
                    {item.automatedCheck?.type === "jira_ticket"
                      ? "This item is automatically checked for completion by verifying Jira ticket status."
                      : item.automatedCheck?.type === "api_check"
                      ? "This item is automatically checked for completion by verifying API status."
                      : "This item uses automated checking."}
                  </p>
                  {item.automatedCheck?.type === "jira_ticket" && item.automatedCheck.config?.jql && (
                    <p className="text-xs font-mono text-muted-foreground mt-2">
                      Query: {item.automatedCheck.config.jql}
                    </p>
                  )}
                </div>
              </Card>
            )}

            {/* Actions Section */}
            <Card className="p-4">
              <h4 className="text-sm font-semibold mb-3">Actions</h4>
              <div className="flex items-center gap-2">
                <Button
                  variant={item.completed ? "outline" : "default"}
                  size="sm"
                  onClick={onToggleComplete}
                >
                  {item.completed ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Mark Incomplete
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Mark Complete
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onToggleAtRisk}
                >
                  <AlertCircle className={cn(
                    "h-4 w-4 mr-2",
                    item.manualAtRisk ? "text-status-degraded" : "text-muted-foreground"
                  )} />
                  {item.manualAtRisk ? "Remove Risk Flag" : "Mark At Risk"}
                </Button>
              </div>
            </Card>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
