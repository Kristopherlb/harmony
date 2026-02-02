import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Event, Action, UserRole } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Play,
  Clock,
  AlertTriangle,
  Server,
  RefreshCw,
  Database,
  Rocket,
  TrendingUp,
  Trash2,
  Loader2,
  Zap,
  HardDrive,
  Wrench,
} from "lucide-react";

interface ActionPanelProps {
  event: Event | null;
  actions: Action[];
  userRole: UserRole;
  className?: string;
}

const ICON_MAP: Record<string, any> = {
  server: Server,
  "refresh-cw": RefreshCw,
  database: Database,
  rocket: Rocket,
  "trending-up": TrendingUp,
  "trash-2": Trash2,
  "hard-drive": HardDrive,
  wrench: Wrench,
};

const RISK_COLORS: Record<string, string> = {
  low: "bg-risk-low/20 text-risk-low border-risk-low/30",
  medium: "bg-risk-medium/20 text-risk-medium border-risk-medium/30",
  high: "bg-risk-high/20 text-risk-high border-risk-high/30",
  critical: "bg-risk-critical/20 text-risk-critical border-risk-critical/30",
};

const RISK_LEVEL_ORDER = ["low", "medium", "high", "critical"];

function calculateRelevanceScore(action: Action, event: Event): number {
  let score = 0;
  
  if (action.targetServices && event.serviceTags) {
    const matchingServices = action.targetServices.filter(
      (service) => event.serviceTags.includes(service)
    );
    score += matchingServices.length * 10;
  }
  
  if (action.contextTypes && action.contextTypes.includes(event.contextType)) {
    score += 20;
  }
  
  const isGlobalAction = !action.targetServices || action.targetServices.length === 0;
  if (isGlobalAction) {
    score -= 5;
  }
  
  return score;
}

function filterAndSortActions(actions: Action[], event: Event | null, userRole: UserRole): Action[] {
  const ROLE_RISK_LEVELS: Record<UserRole, string[]> = {
    viewer: [],
    dev: ["low", "medium"],
    sre: ["low", "medium", "high"],
    admin: ["low", "medium", "high", "critical"],
  };

  const allowedRiskLevels = ROLE_RISK_LEVELS[userRole];
  
  const filtered = actions.filter((action) => {
    if (!action.requiredRoles.includes(userRole)) return false;
    if (!allowedRiskLevels.includes(action.riskLevel)) return false;
    return true;
  });

  if (!event) {
    return filtered.sort((a, b) => {
      const riskDiff = RISK_LEVEL_ORDER.indexOf(a.riskLevel) - RISK_LEVEL_ORDER.indexOf(b.riskLevel);
      if (riskDiff !== 0) return riskDiff;
      return a.name.localeCompare(b.name);
    });
  }

  return filtered
    .map((action) => ({
      action,
      score: calculateRelevanceScore(action, event),
    }))
    .filter(({ action, score }) => score > 0 || (!action.targetServices || action.targetServices.length === 0))
    .sort((a, b) => b.score - a.score)
    .map(({ action }) => action);
}

export function ActionPanel({
  event,
  actions,
  userRole,
  className,
}: ActionPanelProps) {
  const { toast } = useToast();
  const [selectedAction, setSelectedAction] = useState<Action | null>(null);
  const [actionParams, setActionParams] = useState<Record<string, any>>({});
  const [reasoning, setReasoning] = useState("");

  const executeMutation = useMutation({
    mutationFn: async (payload: {
      actionId: string;
      params: Record<string, any>;
      reasoning: string;
      context?: {
        eventId?: string;
        incidentId?: string;
        contextType?: string;
        serviceTags?: string[];
      };
    }) => {
      const res = await apiRequest("POST", "/api/actions/execute", payload);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/actions/executions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/actions/approvals/pending"] });
      
      if (data.requiresApproval) {
        toast({
          title: "Approval Required",
          description: `Action "${selectedAction?.name}" requires approval before execution.`,
        });
      } else {
        toast({
          title: "Action Started",
          description: `Executing "${selectedAction?.name}"...`,
        });
      }
      
      setSelectedAction(null);
      setActionParams({});
      setReasoning("");
    },
    onError: (error) => {
      toast({
        title: "Execution Failed",
        description: error instanceof Error ? error.message : "Failed to execute action",
        variant: "destructive",
      });
    },
  });

  const sortedActions = filterAndSortActions(actions, event, userRole);
  const contextualActions = event 
    ? sortedActions.filter(a => calculateRelevanceScore(a, event) > 0)
    : [];
  const otherActions = event 
    ? sortedActions.filter(a => calculateRelevanceScore(a, event) <= 0)
    : sortedActions;

  const handleExecute = () => {
    if (!selectedAction) return;
    executeMutation.mutate({
      actionId: selectedAction.id,
      params: actionParams,
      reasoning,
      context: event
        ? {
            eventId: event.id,
            incidentId:
              event.incidentId ?? (event.contextType === "incident" ? event.id : undefined),
            contextType: event.contextType,
            serviceTags: event.serviceTags,
          }
        : undefined,
    });
  };

  const renderActionCard = (action: Action, isContextual: boolean = false) => {
    const Icon = ICON_MAP[action.icon || "server"] || Server;
    const matchingTags = event?.serviceTags?.filter(tag => 
      action.targetServices?.includes(tag)
    ) || [];

    return (
      <Card
        key={action.id}
        className={cn(
          "cursor-pointer hover-elevate transition-all",
          isContextual && "border-primary/30 bg-primary/5"
        )}
        onClick={() => {
          setSelectedAction(action);
          setActionParams({});
          setReasoning(event ? `Triggered for: ${event.message.slice(0, 50)}...` : "");
        }}
        data-testid={`action-card-${action.id}`}
      >
        <CardContent className="p-3">
          <div className="flex items-start gap-2">
            <div className="p-1.5 rounded bg-muted">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-sm font-medium truncate">{action.name}</span>
                <Badge className={cn("text-[10px] px-1", RISK_COLORS[action.riskLevel])}>
                  {action.riskLevel}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {action.description}
              </p>
              {matchingTags.length > 0 && (
                <div className="flex items-center gap-1 mt-1.5">
                  <Zap className="h-3 w-3 text-primary" />
                  <span className="text-[10px] text-primary font-medium">
                    Matches: {matchingTags.join(", ")}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-1 mt-1.5 text-[10px] text-muted-foreground">
                <Clock className="h-3 w-3" />
                {action.estimatedDuration || "Unknown"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className={cn("flex flex-col h-full bg-card border-l border-border", className)}>
      <div className="p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Wrench className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Actions</h2>
          {event && (
            <Badge variant="secondary" className="text-xs">
              Context-aware
            </Badge>
          )}
        </div>
        {userRole === "viewer" && (
          <p className="text-xs text-muted-foreground mt-1">
            Viewing mode - no actions available
          </p>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          {event && contextualActions.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Zap className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                  Recommended
                </span>
              </div>
              <div className="space-y-2">
                {contextualActions.map((action) => renderActionCard(action, true))}
              </div>
            </div>
          )}

          {otherActions.length > 0 && (
            <div>
              {event && contextualActions.length > 0 && (
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                  Other Actions
                </span>
              )}
              <div className="space-y-2">
                {otherActions.map((action) => renderActionCard(action, false))}
              </div>
            </div>
          )}

          {sortedActions.length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              {userRole === "viewer" 
                ? "No actions available for your role"
                : "No actions match the current context"}
            </div>
          )}
        </div>
      </ScrollArea>

      <Dialog open={!!selectedAction} onOpenChange={() => setSelectedAction(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedAction && (
                <>
                  {(() => {
                    const Icon = ICON_MAP[selectedAction.icon || "server"] || Server;
                    return <Icon className="h-5 w-5" />;
                  })()}
                  {selectedAction.name}
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedAction?.description}
            </DialogDescription>
          </DialogHeader>

          {selectedAction && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-2">
                <Badge className={RISK_COLORS[selectedAction.riskLevel]}>
                  {selectedAction.riskLevel} risk
                </Badge>
                {(selectedAction.riskLevel === "high" || selectedAction.riskLevel === "critical") && (
                  <Badge variant="outline" className="gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Requires Approval
                  </Badge>
                )}
              </div>

              {selectedAction.requiredParams.map((param) => (
                <div key={param.name} className="space-y-1.5">
                  <Label htmlFor={`param-${param.name}`}>
                    {param.label}
                    {param.required && <span className="text-destructive ml-0.5">*</span>}
                  </Label>
                  
                  {param.type === "select" && param.options ? (
                    <Select
                      value={actionParams[param.name] || ""}
                      onValueChange={(value) =>
                        setActionParams((p) => ({ ...p, [param.name]: value }))
                      }
                    >
                      <SelectTrigger data-testid={`input-param-${param.name}`}>
                        <SelectValue placeholder={param.placeholder || "Select..."} />
                      </SelectTrigger>
                      <SelectContent>
                        {param.options.map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : param.type === "boolean" ? (
                    <div className="flex items-center gap-2">
                      <Switch
                        id={`param-${param.name}`}
                        checked={actionParams[param.name] || false}
                        onCheckedChange={(checked) =>
                          setActionParams((p) => ({ ...p, [param.name]: checked }))
                        }
                        data-testid={`input-param-${param.name}`}
                      />
                      <Label htmlFor={`param-${param.name}`} className="text-sm text-muted-foreground">
                        {param.placeholder || "Enable"}
                      </Label>
                    </div>
                  ) : (
                    <Input
                      id={`param-${param.name}`}
                      type={param.type === "number" ? "number" : "text"}
                      placeholder={param.placeholder}
                      value={actionParams[param.name] || ""}
                      onChange={(e) =>
                        setActionParams((p) => ({ ...p, [param.name]: e.target.value }))
                      }
                      data-testid={`input-param-${param.name}`}
                    />
                  )}
                </div>
              ))}

              <div className="space-y-1.5">
                <Label htmlFor="reasoning">
                  Reasoning <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="reasoning"
                  placeholder="Why are you running this action?"
                  value={reasoning}
                  onChange={(e) => setReasoning(e.target.value)}
                  className="min-h-[80px]"
                  data-testid="input-reasoning"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedAction(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleExecute}
              disabled={executeMutation.isPending || reasoning.length < 10}
              className="gap-1.5"
              data-testid="button-execute-action"
            >
              {executeMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Execute
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
