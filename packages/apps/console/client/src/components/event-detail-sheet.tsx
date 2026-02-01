import { formatDistanceToNow, format } from "date-fns";
import { useState } from "react";
import type { Event, EventSource, EventType, Severity, Comment } from "@shared/schema";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { StatusIndicator } from "./status-indicator";
import { UserActionMenu } from "./user-action-menu";
import {
  ExternalLink,
  Clock,
  User,
  AlertTriangle,
  CheckCircle2,
  GitBranch,
  FileText,
  MessageSquare,
  Activity,
  Link2,
  BarChart3,
  Timer,
  Workflow,
  Edit2,
  Save,
  X,
  Send,
  Trash2,
  ChevronDown,
  Check,
  UserCircle,
} from "lucide-react";
import { SiSlack, SiJira, SiGitlab, SiBitbucket, SiPagerduty } from "react-icons/si";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface EventDetailSheetProps {
  event: Event | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserClick?: (username: string) => void;
  onEventUpdate?: (event: Event) => void;
}

const sourceLabels: Record<EventSource, string> = {
  slack: "Slack",
  jira: "Jira",
  gitlab: "GitLab",
  bitbucket: "Bitbucket",
  pagerduty: "PagerDuty",
};

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

const typeLabels: Record<EventType, string> = {
  log: "Log Entry",
  blocker: "Blocker",
  decision: "Decision",
  release: "Release",
  alert: "Alert",
};

const severityColors: Record<Severity, string> = {
  low: "text-primary",
  medium: "text-status-degraded",
  high: "text-risk-high",
  critical: "text-status-critical",
};

export function EventDetailSheet({ event, open, onOpenChange, onUserClick, onEventUpdate }: EventDetailSheetProps) {
  const { toast } = useToast();
  const [currentEvent, setCurrentEvent] = useState<Event | null>(event);

  // Update currentEvent when event prop changes
  if (event && currentEvent?.id !== event.id) {
    setCurrentEvent(event);
  }

  const updateEventMutation = useMutation({
    mutationFn: async (updates: { severity?: Severity; resolved?: boolean; payload?: Record<string, unknown> }) => {
      const response = await apiRequest("PATCH", `/api/events/${currentEvent?.id}`, updates);
      return response.json();
    },
    onSuccess: (updatedEvent: Event) => {
      setCurrentEvent(updatedEvent);
      onEventUpdate?.(updatedEvent);
      queryClient.invalidateQueries({ queryKey: ['/api/activity/stream'] });
      toast({ title: "Event updated", description: "Changes saved successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update event", variant: "destructive" });
    },
  });

  if (!currentEvent) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg font-mono overflow-y-auto" data-testid="event-detail-sheet">
        <SheetHeader className="space-y-4">
          <div className="flex items-center gap-3">
            <div className={sourceColors[currentEvent.source]}>
              {sourceIcons[currentEvent.source]}
            </div>
            <div>
              <SheetTitle className="text-lg font-semibold">
                {sourceLabels[currentEvent.source]} {typeLabels[currentEvent.type]}
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground mt-1">
                {format(new Date(currentEvent.timestamp), "PPpp")}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="mt-6 h-[calc(100vh-160px)]">
          <div className="space-y-6 pr-4">
            <EventStatusSection 
              event={currentEvent} 
              onUserClick={onUserClick}
              onUpdate={(updates) => updateEventMutation.mutate(updates)}
              isUpdating={updateEventMutation.isPending}
            />
            <Separator />
            <EventMessageSection event={currentEvent} />
            <Separator />
            <SourceSpecificDetails 
              event={currentEvent} 
              onUserClick={onUserClick}
              onUpdate={(updates) => updateEventMutation.mutate(updates)}
              isUpdating={updateEventMutation.isPending}
            />
            <Separator />
            <CommentsSection eventId={currentEvent.id} />
            {currentEvent.externalLink && (
              <>
                <Separator />
                <ExternalLinksSection event={currentEvent} />
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

interface EventStatusSectionProps {
  event: Event;
  onUserClick?: (username: string) => void;
  onUpdate: (updates: { severity?: Severity; resolved?: boolean; payload?: Record<string, unknown> }) => void;
  isUpdating: boolean;
}

const severityOptions: { value: Severity; label: string; color: string }[] = [
  { value: "low", label: "Low", color: "bg-primary" },
  { value: "medium", label: "Medium", color: "bg-status-degraded" },
  { value: "high", label: "High", color: "bg-risk-high" },
  { value: "critical", label: "Critical", color: "bg-status-critical" },
];

function EventStatusSection({ event, onUserClick, onUpdate, isUpdating }: EventStatusSectionProps) {
  const [severityOpen, setSeverityOpen] = useState(false);
  const [reporterMenuOpen, setReporterMenuOpen] = useState(false);

  return (
    <div className="space-y-4">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</h4>
      <div className="grid grid-cols-2 gap-3">
        <Popover open={severityOpen} onOpenChange={setSeverityOpen}>
          <PopoverTrigger asChild>
            <button
              className="group relative flex flex-col items-start p-4 rounded-lg border border-border bg-card hover-elevate transition-all duration-200 cursor-pointer text-left"
              data-testid="button-edit-severity"
              disabled={isUpdating}
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                <AlertTriangle className="h-3 w-3" />
                <span>Severity</span>
                <ChevronDown className="h-3 w-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className={`flex items-center gap-2 ${severityColors[event.severity]}`}>
                <StatusIndicator severity={event.severity} size="sm" />
                <span className="font-semibold capitalize text-sm">{event.severity}</span>
              </div>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-1 z-[200]" align="start">
            <div className="space-y-1">
              {severityOptions.map((option) => (
                <button
                  key={option.value}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm hover-elevate ${
                    event.severity === option.value ? "bg-primary/10 text-primary" : ""
                  }`}
                  onClick={() => {
                    onUpdate({ severity: option.value });
                    setSeverityOpen(false);
                  }}
                  data-testid={`option-severity-${option.value}`}
                >
                  <div className={`w-2.5 h-2.5 rounded-full ${option.color}`} />
                  <span className="flex-1 text-left">{option.label}</span>
                  {event.severity === option.value && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <button
              className="group relative flex flex-col items-start p-4 rounded-lg border border-border bg-card hover-elevate transition-all duration-200 cursor-pointer text-left"
              data-testid="button-toggle-status"
              disabled={isUpdating}
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                <CheckCircle2 className="h-3 w-3" />
                <span>Resolution</span>
                <ChevronDown className="h-3 w-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={event.resolved ? "default" : "secondary"} className="font-semibold">
                  {event.resolved ? (
                    <>
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Resolved
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Open
                    </>
                  )}
                </Badge>
              </div>
              {event.resolvedAt && (
                <div className="text-xs text-muted-foreground mt-2">
                  {formatDistanceToNow(new Date(event.resolvedAt), { addSuffix: true })}
                </div>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-1 z-[200]" align="start">
            <div className="space-y-1">
              <button
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm hover-elevate ${
                  !event.resolved ? "bg-primary/10 text-primary" : ""
                }`}
                onClick={() => onUpdate({ resolved: false })}
                data-testid="option-status-open"
              >
                <AlertTriangle className="h-4 w-4 text-status-degraded" />
                <span className="flex-1 text-left">Open</span>
                {!event.resolved && <Check className="h-4 w-4 text-primary" />}
              </button>
              <button
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm hover-elevate ${
                  event.resolved ? "bg-primary/10 text-primary" : ""
                }`}
                onClick={() => onUpdate({ resolved: true })}
                data-testid="option-status-resolved"
              >
                <CheckCircle2 className="h-4 w-4 text-status-healthy" />
                <span className="flex-1 text-left">Resolved</span>
                {event.resolved && <Check className="h-4 w-4 text-primary" />}
              </button>
            </div>
          </PopoverContent>
        </Popover>

        <div className="flex flex-col items-start p-4 rounded-lg border border-border bg-card/50">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <Clock className="h-3 w-3" />
            <span>Created</span>
          </div>
          <div className="font-semibold text-sm">
            {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
          </div>
        </div>

        {event.username && (
          <UserActionMenu
            username={event.username}
            open={reporterMenuOpen}
            onOpenChange={setReporterMenuOpen}
            onViewProfile={() => onUserClick?.(event.username!)}
            trigger={
              <button
                className="group flex flex-col items-start p-4 rounded-lg border border-border bg-card hover-elevate transition-all duration-200 cursor-pointer text-left"
                data-testid="button-view-reporter"
              >
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2 w-full">
                  <User className="h-3 w-3" />
                  <span>Reporter</span>
                  <ChevronDown className="h-3 w-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="font-semibold text-sm text-primary">
                  @{event.username}
                </div>
              </button>
            }
          />
        )}
      </div>
    </div>
  );
}

function EventMessageSection({ event }: { event: Event }) {
  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Details</h4>
      <Card className="p-4">
        <p className="text-sm leading-relaxed">{event.message}</p>
      </Card>
    </div>
  );
}

interface SourceDetailsProps {
  event: Event;
  onUserClick?: (username: string) => void;
  onUpdate: (updates: { severity?: Severity; resolved?: boolean; payload?: Record<string, unknown> }) => void;
  isUpdating: boolean;
}

function SourceSpecificDetails({ event, onUserClick, onUpdate, isUpdating }: SourceDetailsProps) {
  switch (event.source) {
    case "jira":
      return <JiraDetails event={event} onUserClick={onUserClick} onUpdate={onUpdate} isUpdating={isUpdating} />;
    case "pagerduty":
      return <PagerDutyDetails event={event} onUserClick={onUserClick} onUpdate={onUpdate} isUpdating={isUpdating} />;
    case "gitlab":
      return <GitLabDetails event={event} onUserClick={onUserClick} />;
    case "bitbucket":
      return <BitbucketDetails event={event} onUserClick={onUserClick} />;
    case "slack":
      return <SlackDetails event={event} onUserClick={onUserClick} />;
    default:
      return null;
  }
}

function CommentsSection({ eventId }: { eventId: string }) {
  const { toast } = useToast();
  const [newComment, setNewComment] = useState("");

  const { data: comments = [], isLoading } = useQuery<Comment[]>({
    queryKey: ['/api/events', eventId, 'comments'],
  });

  const addCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await apiRequest("POST", `/api/events/${eventId}/comments`, {
        userId: "current-user",
        username: "you",
        content,
      });
      return response.json();
    },
    onSuccess: () => {
      setNewComment("");
      queryClient.invalidateQueries({ queryKey: ['/api/events', eventId, 'comments'] });
      toast({ title: "Comment added" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add comment", variant: "destructive" });
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      await apiRequest("DELETE", `/api/comments/${commentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/events', eventId, 'comments'] });
      toast({ title: "Comment deleted" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete comment", variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (newComment.trim()) {
      addCommentMutation.mutate(newComment.trim());
    }
  };

  return (
    <div className="space-y-4">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
        <MessageSquare className="h-3 w-3" />
        Comments ({comments.length})
      </h4>

      <div className="space-y-3">
        {isLoading ? (
          <Card className="p-3 text-center text-muted-foreground text-sm">
            Loading comments...
          </Card>
        ) : comments.length === 0 ? (
          <Card className="p-3 text-center text-muted-foreground text-sm">
            No comments yet
          </Card>
        ) : (
          comments.map((comment) => (
            <Card key={comment.id} className="p-3" data-testid={`comment-${comment.id}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-primary">@{comment.username}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm">{comment.content}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => deleteCommentMutation.mutate(comment.id)}
                  disabled={deleteCommentMutation.isPending}
                  data-testid={`button-delete-comment-${comment.id}`}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>

      <div className="flex gap-2">
        <Textarea
          placeholder="Add a comment..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          className="flex-1 min-h-[60px] text-sm"
          data-testid="input-comment"
        />
        <Button
          size="icon"
          onClick={handleSubmit}
          disabled={!newComment.trim() || addCommentMutation.isPending}
          data-testid="button-submit-comment"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

interface JiraDetailsProps {
  event: Event;
  onUserClick?: (username: string) => void;
  onUpdate: (updates: { severity?: Severity; resolved?: boolean; payload?: Record<string, unknown> }) => void;
  isUpdating: boolean;
}

const jiraStatusOptions = [
  { value: "To Do", color: "bg-muted" },
  { value: "In Progress", color: "bg-primary" },
  { value: "In Review", color: "bg-status-degraded" },
  { value: "Done", color: "bg-status-healthy" },
];

const jiraPriorityOptions = [
  { value: "Lowest", color: "bg-muted" },
  { value: "Low", color: "bg-primary" },
  { value: "Medium", color: "bg-status-degraded" },
  { value: "High", color: "bg-risk-high" },
  { value: "Highest", color: "bg-status-critical" },
];

function JiraDetails({ event, onUserClick, onUpdate, isUpdating }: JiraDetailsProps) {
  const [statusOpen, setStatusOpen] = useState(false);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [newAssignee, setNewAssignee] = useState("");

  const payload = event.payload as Record<string, unknown>;
  const issueKey = payload.issueKey as string || extractIssueKey(event.message);
  const epicKey = payload.epicKey as string;
  const projectKey = payload.projectKey as string || issueKey?.split("-")[0];
  const assignee = payload.assignee as string;
  const status = payload.status as string || "To Do";
  const priority = payload.priority as string || "Medium";
  const sprint = payload.sprint as string;

  const handleAssigneeChange = () => {
    if (newAssignee.trim()) {
      onUpdate({ payload: { assignee: newAssignee.trim() } });
      setAssigneeOpen(false);
      setNewAssignee("");
    }
  };

  const getStatusColor = (s: string) => jiraStatusOptions.find(o => o.value === s)?.color || "bg-slate-500";
  const getPriorityColor = (p: string) => jiraPriorityOptions.find(o => o.value === p)?.color || "bg-status-degraded";

  return (
    <div className="space-y-4">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
        <SiJira className="h-3 w-3 text-sky-400" />
        Jira Details
      </h4>
      
      <div className="grid grid-cols-2 gap-3">
        {issueKey && (
          <div className="flex flex-col items-start p-4 rounded-lg border border-border bg-card/50">
            <div className="text-xs text-muted-foreground mb-2">Issue Key</div>
            <div className="font-semibold text-sky-400">{issueKey}</div>
          </div>
        )}
        
        {epicKey && (
          <div className="flex flex-col items-start p-4 rounded-lg border border-border bg-card/50">
            <div className="text-xs text-muted-foreground mb-2">Epic</div>
            <div className="font-semibold text-primary">{epicKey}</div>
          </div>
        )}

        {projectKey && (
          <div className="flex flex-col items-start p-4 rounded-lg border border-border bg-card/50">
            <div className="text-xs text-muted-foreground mb-2">Project</div>
            <div className="font-semibold">{projectKey}</div>
          </div>
        )}

        <Popover open={statusOpen} onOpenChange={setStatusOpen}>
          <PopoverTrigger asChild>
            <button
              className="group flex flex-col items-start p-4 rounded-lg border border-border bg-card hover-elevate transition-all duration-200 cursor-pointer text-left"
              data-testid="button-edit-jira-status"
              disabled={isUpdating}
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2 w-full">
                <span>Status</span>
                <ChevronDown className="h-3 w-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${getStatusColor(status)}`} />
                <span className="font-semibold text-sm">{status}</span>
              </div>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-1 z-[200]" align="start">
            <div className="space-y-1">
              {jiraStatusOptions.map((option) => (
                <button
                  key={option.value}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm hover-elevate ${
                    status === option.value ? "bg-primary/10 text-primary" : ""
                  }`}
                  onClick={() => {
                    onUpdate({ payload: { status: option.value } });
                    setStatusOpen(false);
                  }}
                  data-testid={`option-status-${option.value.toLowerCase().replace(/\s/g, "-")}`}
                >
                  <div className={`w-2.5 h-2.5 rounded-full ${option.color}`} />
                  <span className="flex-1 text-left">{option.value}</span>
                  {status === option.value && <Check className="h-4 w-4 text-primary" />}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Popover open={assigneeOpen} onOpenChange={setAssigneeOpen}>
          <PopoverTrigger asChild>
            <button
              className="group flex flex-col items-start p-4 rounded-lg border border-border bg-card hover-elevate transition-all duration-200 cursor-pointer text-left"
              data-testid="button-edit-assignee"
              disabled={isUpdating}
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2 w-full">
                <User className="h-3 w-3" />
                <span>Assignee</span>
                <ChevronDown className="h-3 w-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              {assignee ? (
                <span className="font-semibold text-sm text-primary">@{assignee}</span>
              ) : (
                <span className="text-muted-foreground text-sm">Unassigned</span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-3 z-[200]" align="start">
            <div className="space-y-3">
              <div className="text-xs font-medium text-muted-foreground">Set Assignee</div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newAssignee}
                  onChange={(e) => setNewAssignee(e.target.value)}
                  placeholder="Enter username"
                  className="flex-1 h-9 px-3 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  data-testid="input-assignee"
                  onKeyDown={(e) => e.key === "Enter" && handleAssigneeChange()}
                />
                <Button size="sm" onClick={handleAssigneeChange} disabled={isUpdating || !newAssignee.trim()} data-testid="button-save-assignee">
                  <Check className="h-4 w-4" />
                </Button>
              </div>
              {assignee && (
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover-elevate"
                  onClick={() => onUserClick?.(assignee)}
                  data-testid="button-view-assignee-profile"
                >
                  <User className="h-4 w-4" />
                  View @{assignee}'s profile
                </button>
              )}
            </div>
          </PopoverContent>
        </Popover>

        <Popover open={priorityOpen} onOpenChange={setPriorityOpen}>
          <PopoverTrigger asChild>
            <button
              className="group flex flex-col items-start p-4 rounded-lg border border-border bg-card hover-elevate transition-all duration-200 cursor-pointer text-left"
              data-testid="button-edit-priority"
              disabled={isUpdating}
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2 w-full">
                <span>Priority</span>
                <ChevronDown className="h-3 w-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${getPriorityColor(priority)}`} />
                <span className="font-semibold text-sm">{priority}</span>
              </div>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-1 z-[200]" align="start">
            <div className="space-y-1">
              {jiraPriorityOptions.map((option) => (
                <button
                  key={option.value}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm hover-elevate ${
                    priority === option.value ? "bg-primary/10 text-primary" : ""
                  }`}
                  onClick={() => {
                    onUpdate({ payload: { priority: option.value } });
                    setPriorityOpen(false);
                  }}
                  data-testid={`option-priority-${option.value.toLowerCase()}`}
                >
                  <div className={`w-2.5 h-2.5 rounded-full ${option.color}`} />
                  <span className="flex-1 text-left">{option.value}</span>
                  {priority === option.value && <Check className="h-4 w-4 text-primary" />}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {sprint && (
          <div className="flex flex-col items-start p-4 rounded-lg border border-border bg-card/50">
            <div className="text-xs text-muted-foreground mb-2">Sprint</div>
            <div className="font-semibold text-sm">{sprint}</div>
          </div>
        )}
      </div>

      <Card className="p-3 bg-muted/30">
        <div className="text-xs text-muted-foreground mb-2">Quick Actions</div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="text-xs" asChild>
            <a href={`https://jira.atlassian.com/browse/${issueKey}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3 w-3 mr-1" />
              Open in Jira
            </a>
          </Button>
          {epicKey && (
            <Button variant="outline" size="sm" className="text-xs" asChild>
              <a href={`https://jira.atlassian.com/browse/${epicKey}`} target="_blank" rel="noopener noreferrer">
                <Workflow className="h-3 w-3 mr-1" />
                View Epic
              </a>
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

interface PagerDutyDetailsProps {
  event: Event;
  onUserClick?: (username: string) => void;
  onUpdate: (updates: { severity?: Severity; resolved?: boolean; payload?: Record<string, unknown> }) => void;
  isUpdating: boolean;
}

const urgencyOptions = [
  { value: "low", label: "Low", color: "bg-status-degraded" },
  { value: "high", label: "High", color: "bg-status-critical" },
];

function PagerDutyDetails({ event, onUserClick, onUpdate, isUpdating }: PagerDutyDetailsProps) {
  const [urgencyOpen, setUrgencyOpen] = useState(false);
  const [oncallMenuOpen, setOncallMenuOpen] = useState(false);
  const payload = event.payload as Record<string, unknown>;
  const incidentId = payload.incidentId as string;
  const service = payload.service as string;
  const urgency = payload.urgency as string || "low";
  const escalationPolicy = payload.escalationPolicy as string;
  const oncall = payload.oncall as string;
  const runbookUrl = payload.runbookUrl as string;
  const dashboardUrl = payload.dashboardUrl as string;
  const mttr = payload.mttr as number;

  const getUrgencyColor = (u: string) => u === "high" ? "bg-status-critical" : "bg-status-degraded";

  return (
    <div className="space-y-4">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
        <SiPagerduty className="h-3 w-3 text-status-critical" />
        PagerDuty Incident
      </h4>

      <div className="grid grid-cols-2 gap-3">
        {incidentId && (
          <div className="flex flex-col items-start p-4 rounded-lg border border-border bg-card/50">
            <div className="text-xs text-muted-foreground mb-2">Incident ID</div>
            <div className="font-semibold text-status-critical">{incidentId}</div>
          </div>
        )}

        {service && (
          <div className="flex flex-col items-start p-4 rounded-lg border border-border bg-card/50">
            <div className="text-xs text-muted-foreground mb-2">Service</div>
            <div className="font-semibold">{service}</div>
          </div>
        )}

        <Popover open={urgencyOpen} onOpenChange={setUrgencyOpen}>
          <PopoverTrigger asChild>
            <button
              className="group flex flex-col items-start p-4 rounded-lg border border-border bg-card hover-elevate transition-all duration-200 cursor-pointer text-left"
              data-testid="button-edit-urgency"
              disabled={isUpdating}
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2 w-full">
                <AlertTriangle className="h-3 w-3" />
                <span>Urgency</span>
                <ChevronDown className="h-3 w-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${getUrgencyColor(urgency)}`} />
                <span className="font-semibold text-sm capitalize">{urgency}</span>
              </div>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-40 p-1 z-[200]" align="start">
            <div className="space-y-1">
              {urgencyOptions.map((option) => (
                <button
                  key={option.value}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm hover-elevate ${
                    urgency === option.value ? "bg-primary/10 text-primary" : ""
                  }`}
                  onClick={() => {
                    onUpdate({ payload: { urgency: option.value } });
                    setUrgencyOpen(false);
                  }}
                  data-testid={`option-urgency-${option.value}`}
                >
                  <div className={`w-2.5 h-2.5 rounded-full ${option.color}`} />
                  <span className="flex-1 text-left">{option.label}</span>
                  {urgency === option.value && <Check className="h-4 w-4 text-primary" />}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {escalationPolicy && (
          <div className="flex flex-col items-start p-4 rounded-lg border border-border bg-card/50">
            <div className="text-xs text-muted-foreground mb-2">Escalation Policy</div>
            <div className="font-semibold text-sm">{escalationPolicy}</div>
          </div>
        )}

        {oncall && (
          <UserActionMenu
            username={oncall}
            open={oncallMenuOpen}
            onOpenChange={setOncallMenuOpen}
            onViewProfile={() => onUserClick?.(oncall)}
            trigger={
              <button
                className="group flex flex-col items-start p-4 rounded-lg border border-border bg-card hover-elevate transition-all duration-200 cursor-pointer text-left"
                data-testid="button-view-oncall"
              >
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2 w-full">
                  <User className="h-3 w-3" />
                  <span>On-Call</span>
                  <ChevronDown className="h-3 w-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <span className="font-semibold text-sm text-primary">@{oncall}</span>
              </button>
            }
          />
        )}

        {mttr !== undefined && (
          <div className="flex flex-col items-start p-4 rounded-lg border border-border bg-card/50">
            <div className="text-xs text-muted-foreground mb-2">MTTR</div>
            <div className="font-semibold">{mttr} minutes</div>
          </div>
        )}
      </div>

      <Card className="p-3 border-status-degraded/30 bg-status-degraded/5">
        <div className="text-xs text-muted-foreground mb-2 flex items-center gap-2">
          <Activity className="h-3 w-3" />
          Incident Timeline
        </div>
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-status-critical" />
            <span className="text-muted-foreground">Triggered:</span>
            <span>{format(new Date(event.timestamp), "HH:mm:ss")}</span>
          </div>
          {event.resolved && event.resolvedAt && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-status-healthy" />
              <span className="text-muted-foreground">Resolved:</span>
              <span>{format(new Date(event.resolvedAt), "HH:mm:ss")}</span>
            </div>
          )}
        </div>
      </Card>

      <Card className="p-3 bg-muted/30">
        <div className="text-xs text-muted-foreground mb-2">Quick Actions</div>
        <div className="flex flex-wrap gap-2">
          {event.externalLink && (
            <Button variant="outline" size="sm" className="text-xs" asChild>
              <a href={event.externalLink} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3 w-3 mr-1" />
                View Incident
              </a>
            </Button>
          )}
          {runbookUrl && (
            <Button variant="outline" size="sm" className="text-xs" asChild>
              <a href={runbookUrl} target="_blank" rel="noopener noreferrer">
                <FileText className="h-3 w-3 mr-1" />
                Runbook
              </a>
            </Button>
          )}
          {dashboardUrl && (
            <Button variant="outline" size="sm" className="text-xs" asChild>
              <a href={dashboardUrl} target="_blank" rel="noopener noreferrer">
                <BarChart3 className="h-3 w-3 mr-1" />
                Dashboard
              </a>
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

function GitLabDetails({ event, onUserClick }: { event: Event; onUserClick?: (username: string) => void }) {
  const payload = event.payload as Record<string, unknown>;
  const projectName = payload.projectName as string;
  const branch = payload.branch as string;
  const pipelineId = payload.pipelineId as string;
  const mrId = payload.mrId as string;
  const commitSha = payload.commitSha as string;
  const leadTimeHours = payload.leadTimeHours as number;
  const failed = payload.failed as boolean;
  const author = payload.author as string;

  return (
    <div className="space-y-4">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
        <SiGitlab className="h-3 w-3 text-primary" />
        GitLab Details
      </h4>

      <div className="grid grid-cols-2 gap-3">
        {projectName && (
          <Card className="p-3">
            <div className="text-xs text-muted-foreground mb-1">Project</div>
            <div className="font-semibold">{projectName}</div>
          </Card>
        )}

        {branch && (
          <Card className="p-3">
            <div className="text-xs text-muted-foreground mb-1">Branch</div>
            <div className="font-semibold text-primary flex items-center gap-1">
              <GitBranch className="h-3 w-3" />
              {branch}
            </div>
          </Card>
        )}

        {pipelineId && (
          <Card className="p-3">
            <div className="text-xs text-muted-foreground mb-1">Pipeline</div>
            <Badge variant={failed ? "destructive" : "default"}>
              #{pipelineId}
            </Badge>
          </Card>
        )}

        {mrId && (
          <Card className="p-3">
            <div className="text-xs text-muted-foreground mb-1">Merge Request</div>
            <div className="font-semibold">!{mrId}</div>
          </Card>
        )}

        {commitSha && (
          <Card className="p-3">
            <div className="text-xs text-muted-foreground mb-1">Commit</div>
            <code className="text-xs bg-muted px-1 py-0.5 rounded">{commitSha.substring(0, 8)}</code>
          </Card>
        )}

        {leadTimeHours !== undefined && (
          <Card className="p-3">
            <div className="text-xs text-muted-foreground mb-1">Lead Time</div>
            <div className="font-semibold flex items-center gap-1">
              <Timer className="h-3 w-3" />
              {leadTimeHours}h
            </div>
          </Card>
        )}
      </div>

      <Card className="p-3 bg-muted/30">
        <div className="text-xs text-muted-foreground mb-2">Quick Actions</div>
        <div className="flex flex-wrap gap-2">
          {event.externalLink && (
            <Button variant="outline" size="sm" className="text-xs" asChild>
              <a href={event.externalLink} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3 w-3 mr-1" />
                View in GitLab
              </a>
            </Button>
          )}
          {pipelineId && (
            <Button variant="outline" size="sm" className="text-xs">
              <Activity className="h-3 w-3 mr-1" />
              View Pipeline
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

function BitbucketDetails({ event, onUserClick }: { event: Event; onUserClick?: (username: string) => void }) {
  const payload = event.payload as Record<string, unknown>;
  const repository = payload.repository as string;
  const branch = payload.branch as string;
  const prId = payload.prId as string;
  const commitHash = payload.commitHash as string;
  const author = payload.author as string;
  const leadTimeHours = payload.leadTimeHours as number;

  return (
    <div className="space-y-4">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
        <SiBitbucket className="h-3 w-3 text-violet-400" />
        Bitbucket Details
      </h4>

      <div className="grid grid-cols-2 gap-3">
        {repository && (
          <Card className="p-3">
            <div className="text-xs text-muted-foreground mb-1">Repository</div>
            <div className="font-semibold">{repository}</div>
          </Card>
        )}

        {branch && (
          <Card className="p-3">
            <div className="text-xs text-muted-foreground mb-1">Branch</div>
            <div className="font-semibold text-violet-400 flex items-center gap-1">
              <GitBranch className="h-3 w-3" />
              {branch}
            </div>
          </Card>
        )}

        {prId && (
          <Card className="p-3">
            <div className="text-xs text-muted-foreground mb-1">Pull Request</div>
            <div className="font-semibold">#{prId}</div>
          </Card>
        )}

        {author && (
          <Card className="p-3">
            <div className="text-xs text-muted-foreground mb-1">Author</div>
            <button
              className="font-semibold text-primary hover:underline cursor-pointer"
              onClick={() => onUserClick?.(author)}
              data-testid="button-view-author"
            >
              @{author}
            </button>
          </Card>
        )}

        {commitHash && (
          <Card className="p-3">
            <div className="text-xs text-muted-foreground mb-1">Commit</div>
            <code className="text-xs bg-muted px-1 py-0.5 rounded">{commitHash.substring(0, 8)}</code>
          </Card>
        )}

        {leadTimeHours !== undefined && (
          <Card className="p-3">
            <div className="text-xs text-muted-foreground mb-1">Lead Time</div>
            <div className="font-semibold flex items-center gap-1">
              <Timer className="h-3 w-3" />
              {leadTimeHours}h
            </div>
          </Card>
        )}
      </div>

      <Card className="p-3 bg-muted/30">
        <div className="text-xs text-muted-foreground mb-2">Quick Actions</div>
        <div className="flex flex-wrap gap-2">
          {event.externalLink && (
            <Button variant="outline" size="sm" className="text-xs" asChild>
              <a href={event.externalLink} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3 w-3 mr-1" />
                View in Bitbucket
              </a>
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

function SlackDetails({ event, onUserClick }: { event: Event; onUserClick?: (username: string) => void }) {
  const payload = event.payload as Record<string, unknown>;
  const channel = payload.channel as string;
  const thread = payload.thread as string;

  return (
    <div className="space-y-4">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
        <SiSlack className="h-3 w-3 text-primary" />
        Slack Details
      </h4>

      <div className="grid grid-cols-2 gap-3">
        {channel && (
          <Card className="p-3">
            <div className="text-xs text-muted-foreground mb-1">Channel</div>
            <div className="font-semibold text-primary">#{channel}</div>
          </Card>
        )}

        {thread && (
          <Card className="p-3">
            <div className="text-xs text-muted-foreground mb-1">Thread</div>
            <div className="font-semibold">{thread}</div>
          </Card>
        )}

        {event.username && (
          <Card className="p-3">
            <div className="text-xs text-muted-foreground mb-1">Posted by</div>
            <button
              className="font-semibold text-primary hover:underline cursor-pointer"
              onClick={() => onUserClick?.(event.username!)}
              data-testid="button-view-slack-user"
            >
              @{event.username}
            </button>
          </Card>
        )}
      </div>

      <Card className="p-3 bg-muted/30">
        <div className="text-xs text-muted-foreground mb-2">Quick Actions</div>
        <div className="flex flex-wrap gap-2">
          {event.externalLink && (
            <Button variant="outline" size="sm" className="text-xs" asChild>
              <a href={event.externalLink} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3 w-3 mr-1" />
                Open in Slack
              </a>
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

function ExternalLinksSection({ event }: { event: Event }) {
  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
        <Link2 className="h-3 w-3" />
        External Links
      </h4>
      <Button className="w-full" asChild data-testid="button-open-external">
        <a href={event.externalLink} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="h-4 w-4 mr-2" />
          Open in {sourceLabels[event.source]}
        </a>
      </Button>
    </div>
  );
}

function extractIssueKey(message: string): string | undefined {
  const match = message.match(/([A-Z]+-\d+)/);
  return match ? match[1] : undefined;
}
