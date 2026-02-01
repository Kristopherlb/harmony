import { formatDistanceToNow, format } from "date-fns";
import { cn } from "@/lib/utils";
import type { Event, EventSource, EventType, ContextType } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  MessageSquare,
  AlertTriangle,
  FileText,
  GitBranch,
  Bell,
  ExternalLink,
  Clock,
  User,
  Tag,
  Activity,
  CheckCircle,
  XCircle,
  Server,
  ChevronLeft,
} from "lucide-react";
import { SiSlack, SiJira, SiGitlab, SiBitbucket, SiPagerduty } from "react-icons/si";

interface ContextWorkspaceProps {
  event: Event | null;
  relatedEvents?: Event[];
  isMobile?: boolean;
  onBack?: () => void;
  className?: string;
}

const sourceIcons: Record<EventSource, React.ReactNode> = {
  slack: <SiSlack className="h-5 w-5" />,
  jira: <SiJira className="h-5 w-5" />,
  gitlab: <SiGitlab className="h-5 w-5" />,
  bitbucket: <SiBitbucket className="h-5 w-5" />,
  pagerduty: <SiPagerduty className="h-5 w-5" />,
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
  log: <MessageSquare className="h-5 w-5" />,
  blocker: <AlertTriangle className="h-5 w-5" />,
  decision: <FileText className="h-5 w-5" />,
  release: <GitBranch className="h-5 w-5" />,
  alert: <Bell className="h-5 w-5" />,
};

const typeLabels: Record<EventType, string> = {
  log: "Log Entry",
  blocker: "Blocker",
  decision: "Decision",
  release: "Release",
  alert: "Alert",
};

const severityColors: Record<string, string> = {
  critical: "bg-status-critical/20 text-status-critical border-status-critical/30",
  high: "bg-risk-high/20 text-risk-high border-risk-high/30",
  medium: "bg-status-degraded/20 text-status-degraded border-status-degraded/30",
  low: "bg-status-healthy/20 text-status-healthy border-status-healthy/30",
};

const contextTypeLabels: Record<ContextType, string> = {
  incident: "Incident",
  support_ticket: "Support Ticket",
  deployment_failure: "Deployment Failure",
  security_alert: "Security Alert",
  infrastructure: "Infrastructure",
  general: "General",
};

const contextTypeColors: Record<ContextType, string> = {
  incident: "bg-status-critical/20 text-status-critical",
  support_ticket: "bg-primary/20 text-primary",
  deployment_failure: "bg-risk-high/20 text-risk-high",
  security_alert: "bg-primary/20 text-primary",
  infrastructure: "bg-primary/20 text-primary",
  general: "bg-muted text-muted-foreground",
};

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Activity className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">Select a Signal</h3>
      <p className="text-sm text-muted-foreground max-w-xs">
        Click on a signal from the stream to view its details and related context
      </p>
    </div>
  );
}

function IncidentWorkspace({ event }: { event: Event }) {
  return (
    <div className="space-y-4">
      <Card className="border-status-critical/30 bg-status-critical/5">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-status-critical" />
            <CardTitle className="text-status-critical">Incident Details</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Status:</span>
              <div className="flex items-center gap-1.5 mt-1">
                {event.resolved ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-status-healthy" />
                    <span className="text-status-healthy">Resolved</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 text-status-critical" />
                    <span className="text-status-critical">Active</span>
                  </>
                )}
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">Duration:</span>
              <p className="font-medium">
                {event.resolvedAt
                  ? `${Math.round((new Date(event.resolvedAt).getTime() - new Date(event.timestamp).getTime()) / 60000)} min`
                  : formatDistanceToNow(new Date(event.timestamp))}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function InfrastructureWorkspace({ event }: { event: Event }) {
  return (
    <div className="space-y-4">
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5 text-primary" />
            <CardTitle className="text-primary">Infrastructure Context</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {event.serviceTags && event.serviceTags.length > 0 && (
            <div>
              <span className="text-sm text-muted-foreground">Affected Services:</span>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {event.serviceTags.map((tag) => (
                  <Badge key={tag} variant="outline" className="font-mono text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DeploymentWorkspace({ event }: { event: Event }) {
  return (
    <div className="space-y-4">
      <Card className="border-risk-high/30 bg-risk-high/5">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-risk-high" />
            <CardTitle className="text-risk-high">Deployment Context</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {event.payload && (
            <div>
              <span className="text-sm text-muted-foreground">Deployment Info:</span>
              <div className="mt-2 p-3 rounded bg-muted/50 font-mono text-xs">
                <pre className="whitespace-pre-wrap">
                  {JSON.stringify(event.payload, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function ContextWorkspace({
  event,
  relatedEvents = [],
  isMobile = false,
  onBack,
  className,
}: ContextWorkspaceProps) {
  if (!event) {
    return (
      <div className={cn("flex flex-col h-full bg-background", className)}>
        <EmptyState />
      </div>
    );
  }

  const contextType = event.contextType || "general";

  return (
    <div className={cn("flex flex-col h-full bg-background", className)}>
      {isMobile && onBack && (
        <div className="sticky top-0 z-10 bg-card border-b border-border p-3">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onBack} 
            className="gap-1.5"
            data-testid="button-back"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to signals
          </Button>
        </div>
      )}
      
      <div className="p-4 border-b border-border">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={cn("p-2 rounded-lg bg-muted", sourceColors[event.source])}>
              {sourceIcons[event.source]}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={contextTypeColors[contextType]}>
                  {contextTypeLabels[contextType]}
                </Badge>
                <Badge variant="outline">{typeLabels[event.type]}</Badge>
                <Badge className={severityColors[event.severity]}>
                  {event.severity.toUpperCase()}
                </Badge>
              </div>
              <h1 className="text-lg font-semibold text-foreground mt-2 line-clamp-2">
                {event.message}
              </h1>
            </div>
          </div>

          {event.externalLink && (
            <Button variant="outline" size="sm" className="gap-1.5 shrink-0 hidden md:inline-flex" asChild>
              <a href={event.externalLink} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                Open in {sourceLabels[event.source]}
              </a>
            </Button>
          )}
        </div>
        
        {isMobile && event.externalLink && (
          <Button variant="outline" size="sm" className="gap-1.5 w-full mt-3" asChild>
            <a href={event.externalLink} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5" />
              Open in {sourceLabels[event.source]}
            </a>
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Signal Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Timestamp:</span>
                </div>
                <span className="font-medium">
                  {format(new Date(event.timestamp), "PPpp")}
                </span>

                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Source:</span>
                </div>
                <span className="font-medium">{sourceLabels[event.source]}</span>

                {event.username && (
                  <>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Reporter:</span>
                    </div>
                    <span className="font-medium">@{event.username}</span>
                  </>
                )}

                {event.resolved && event.resolvedAt && (
                  <>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-status-healthy" />
                      <span className="text-muted-foreground">Resolved At:</span>
                    </div>
                    <span className="font-medium text-status-healthy">
                      {format(new Date(event.resolvedAt), "PPpp")}
                    </span>
                  </>
                )}
              </div>

              {event.serviceTags && event.serviceTags.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Tag className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Service Tags:</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {event.serviceTags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="font-mono text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {contextType === "incident" && <IncidentWorkspace event={event} />}
          {contextType === "infrastructure" && <InfrastructureWorkspace event={event} />}
          {contextType === "deployment_failure" && <DeploymentWorkspace event={event} />}

          {event.payload && Object.keys(event.payload).length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Payload Data</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-3 rounded bg-muted/50 font-mono text-xs overflow-x-auto">
                  <pre className="whitespace-pre-wrap">
                    {JSON.stringify(event.payload, null, 2)}
                  </pre>
                </div>
              </CardContent>
            </Card>
          )}

          {relatedEvents.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Related Signals ({relatedEvents.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {relatedEvents.slice(0, 5).map((relEvent) => (
                    <div
                      key={relEvent.id}
                      className="flex items-center gap-2 p-2 rounded bg-muted/30 text-sm"
                    >
                      <div className={sourceColors[relEvent.source]}>
                        {sourceIcons[relEvent.source]}
                      </div>
                      <span className="flex-1 truncate">{relEvent.message}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(relEvent.timestamp), { addSuffix: true })}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
